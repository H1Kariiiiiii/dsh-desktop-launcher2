// dsh-icon-console host entry.
//
// Desktop icon console for DeepSeek Harness: import an icon once and apply it
// to the Windows shortcuts, the application window image and the system tray
// image — plus graceful exit and shell-mediated restart.
//
// Settings contract (0.1.7+ / 0.2.0): a form is addressed by the PROFILE ENTRY
// ID its Config schema belongs to. `.volatile()` is what makes a field part of
// a settings form at all — the Host projects only volatile fields, and
// `settings.update()` rejects any path that is not volatile. The removed
// `register`/`installSection` namespace contract has no replacement call.
//
// Routes (all loopback-only):
//   GET  /api/dsh-icon-console/status            — current icon state
//   POST /api/dsh-icon-console/apply             — apply an icon to a scope
//   POST /api/dsh-icon-console/restore           — restore official icons
//   GET  /api/dsh-icon-console/library           — list the saved icon library
//   POST /api/dsh-icon-console/library/add       — save an icon to the library
//   POST /api/dsh-icon-console/library/remove    — delete a library entry
//   POST /api/dsh-icon-console/upload            — store an uploaded icon
//   POST /api/dsh-icon-console/restart           — bounded host exit (shell relaunches)
//   POST /api/dsh-icon-console/exit              — bounded host exit
//   GET  /api/dsh-icon-console/settings          — read console settings
//   POST /api/dsh-icon-console/settings          — write console settings
// @module dsh-icon-console

import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import {
  ACCEPTED_EXTENSIONS,
  SHORTCUT_TARGETS,
  addToLibrary,
  applyIcon,
  describeState,
  ensureIconBackup,
  ensureStateDirs,
  libraryDir,
  listLibrary,
  readState,
  removeFromLibrary,
  restoreApplicationIcon,
  restoreShortcuts,
  writeState,
} from './host/icons.js'
import { isDesktopHost, restartExplanation, scheduleExit } from './host/restart.js'

export const name = 'dsh-icon-console'

/** Services required before the console surfaces can mount. */
export const inject = ['webServer']

/**
 * Settings entry id of the icon console.
 *
 * 0.1.7 removed the arbitrary-namespace contract; a form is now addressed by
 * the profile entry id its Config schema belongs to. This row's id is the
 * package name, so the settings namespace and the entry id coincide.
 */
export const SETTINGS_NS = 'dsh-icon-console'

/** Defaults, kept as plain data so the fallback layer stays schema-free. */
const CONFIG_DEFAULTS = {
  /** Master switch for the plugin. */
  enabled: true,
  /** Re-apply the remembered icon when a shortcut is found pointing elsewhere. */
  autoReapply: false,
  /** Include the Start Menu shortcut whenever the desktop shortcut is targeted. */
  includeStartMenu: true,
  /** Remembered icon source, reused by "apply again". */
  lastIcon: '',
}

/**
 * Editable fields of the entry.
 *
 * `.volatile()` puts a field into the settings form and makes it writable
 * through `settings.update()`. Fields are declared individually so each
 * carries its own default and the form gets one input per field.
 */
export const Config = z.object({
  /** Master switch for the plugin. */
  enabled: z.boolean().default(true).volatile(),
  /** Re-apply the remembered icon when a shortcut is found pointing elsewhere. */
  autoReapply: z.boolean().default(false).volatile(),
  /** Include the Start Menu shortcut whenever the desktop shortcut is targeted. */
  includeStartMenu: z.boolean().default(true).volatile(),
})

/** Backwards-compatible alias: the same schema under its historical name. */
export const SettingsSchema = Config

/** Upper bound for an uploaded icon body (base64 inflates by ~33%). */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/**
 * Unwrap a schemastery volatile reference.
 *
 * `.volatile()` parses a field into a stable reference read with `.get()`; the
 * raw value is never a plain scalar, and spreading it writes `[object Object]`.
 * Every consumer of this plugin's config expects plain data, so all reads go
 * through here.
 */
function unwrapVolatile(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try { return value.get() } catch { return undefined }
  }
  return value
}

/** Flatten a config object so every volatile field becomes plain data. */
function unwrapConfig(source) {
  const out = {}
  for (const [key, value] of Object.entries(source ?? {})) out[key] = unwrapVolatile(value)
  return out
}

/**
 * Resolve live config from the settings form projection.
 *
 * SettingsForms has no `get(ns)`; the entry's values arrive through
 * `describe()` (keyed by profile entry id, volatile fields only). Falls back
 * to the composition config when the descriptor is not available yet.
 */
async function resolveConfig(ctx, fallback) {
  const settings = ctx.get('settings')
  const base = { ...unwrapConfig(fallback), ...(await readState()) }
  if (settings === undefined || typeof settings.describe !== 'function') return base
  try {
    const row = settings.describe().find((candidate) => candidate.ns === SETTINGS_NS)
    if (row === undefined) return base
    return { ...base, ...unwrapConfig(row.value) }
  } catch {
    return base
  }
}

/** Loopback IPv4 predicate. */
function isIPv4Loopback(value) {
  const parts = value.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Whether a socket address names the loopback range. */
function isLoopbackAddress(address) {
  if (typeof address !== 'string') return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isIPv4Loopback(normalized.slice('::ffff:'.length))
  return isIPv4Loopback(normalized)
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  return isIPv4Loopback(hostname)
}

/**
 * Request-level trust fence: loopback socket address and loopback Host header,
 * plus the browser same-origin markers. The socket address is authoritative;
 * forwarding headers are never trusted.
 */
function isLoopbackRequest(request) {
  if (!isLoopbackAddress(request.socket?.remoteAddress)) return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl
  try { hostUrl = new URL('http://' + host) } catch { return false }
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try { return new URL(origin).host === hostUrl.host } catch { return false }
}

/** One JSON response. */
function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(JSON.stringify(body))
}

/** Read a JSON request body with a byte ceiling. */
function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) { resolve({ tooLarge: true }); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw === '') { resolve({ value: undefined }); return }
      try { resolve({ value: JSON.parse(raw) }) } catch { resolve({ invalid: true }) }
    })
    req.on('error', () => resolve({ invalid: true }))
  })
}

/** Reject anything but POST with a JSON 405. */
function requirePost(req, res) {
  if ((req.method ?? 'GET') === 'POST') return true
  writeJson(res, 405, { ok: false, error: 'method not allowed' })
  return false
}

/**
 * Persist an uploaded icon (base64 body) into the library and return its path.
 * A desktop web view cannot reveal a native file path, so upload is the
 * friendly way in.
 * @param body - { name, data } where data is a data-URL or bare base64.
 * @returns { ok, path } or { ok: false, error }.
 */
async function storeUpload(body) {
  const name = typeof body?.name === 'string' && body.name.trim() !== '' ? body.name.trim() : `upload-${Date.now()}.ico`
  let data = typeof body?.data === 'string' ? body.data : ''
  if (data === '') return { ok: false, error: '上传内容为空' }
  const comma = data.indexOf(',')
  if (data.startsWith('data:') && comma !== -1) data = data.slice(comma + 1)
  let buffer
  try { buffer = Buffer.from(data, 'base64') } catch { return { ok: false, error: 'base64 数据无效' } }
  if (buffer.length === 0) return { ok: false, error: '上传内容为空' }
  const ext = extname(name).toLowerCase()
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `不支持的格式 ${ext || '(无扩展名)'}（仅支持 ${ACCEPTED_EXTENSIONS.join(' / ')}）` }
  }
  if (ext === '.png') {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if (!buffer.subarray(0, 8).equals(pngSignature)) return { ok: false, error: 'PNG 文件头无效' }
  }
  await ensureStateDirs()
  const safe = name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 64)
  const target = join(libraryDir(), safe)
  try { await writeFile(target, buffer) } catch (error) {
    return { ok: false, error: `写入失败: ${error instanceof Error ? error.message : String(error)}` }
  }
  return { ok: true, path: target, name: safe, bytes: buffer.length, ext }
}

/** Resolve the icon source from a request body: an explicit path or an upload. */
async function resolveSource(input) {
  if (typeof input?.source === 'string' && input.source.trim() !== '') {
    const path = input.source.trim()
    if (!existsSync(path)) return { ok: false, error: `图标文件不存在: ${path}` }
    return { ok: true, path }
  }
  if (input?.upload !== undefined) {
    const stored = await storeUpload(input.upload)
    if (!stored.ok) return stored
    return { ok: true, path: stored.path }
  }
  return { ok: false, error: '未提供图标（source 路径或 upload 上传）' }
}

/** Build the route family. */
function makeRoutes(ctx, fallback) {
  return [
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/status',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        try {
          const state = await describeState()
          writeJson(res, 200, {
            ok: true,
            ...state,
            desktopHost: isDesktopHost(),
            restartHint: restartExplanation(),
            acceptedExtensions: ACCEPTED_EXTENSIONS,
            shortcutsOrder: SHORTCUT_TARGETS,
            applicationOrder: ['icon.png', 'tray.ico'],
            settings: await resolveConfig(ctx, fallback),
          })
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/apply',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        if (!requirePost(req, res)) return
        const body = await readJsonBody(req, MAX_UPLOAD_BYTES)
        if (body.tooLarge) { writeJson(res, 413, { ok: false, error: '图标过大（上限 8 MB）' }); return }
        if (body.invalid || typeof body.value !== 'object' || body.value === null) {
          writeJson(res, 400, { ok: false, error: 'invalid JSON body' }); return
        }
        const input = body.value
        const source = await resolveSource(input)
        if (!source.ok) { writeJson(res, 400, source); return }
        try {
          const report = await applyIcon({
            source: source.path,
            shortcuts: Array.isArray(input.shortcuts) ? input.shortcuts : [],
            application: Array.isArray(input.application) ? input.application : [],
          })
          if (report.ok) {
            await writeState({
              lastIcon: source.path,
              lastAppliedAt: Date.now(),
              lastShortcuts: input.shortcuts ?? [],
              lastApplication: input.application ?? [],
            })
          }
          writeJson(res, report.ok ? 200 : 500, report)
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/restore',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        if (!requirePost(req, res)) return
        const body = await readJsonBody(req)
        const input = typeof body.value === 'object' && body.value !== null ? body.value : {}
        const scope = typeof input.scope === 'string' ? input.scope : 'all'
        try {
          const report = { ok: true, shortcuts: {}, application: {}, needsRestart: false }
          if (scope === 'all' || scope === 'shortcuts') report.shortcuts = await restoreShortcuts()
          if (scope === 'all' || scope === 'application') {
            for (const iconName of ['icon.png', 'tray.ico']) {
              report.application[iconName] = await restoreApplicationIcon(iconName)
              if (report.application[iconName].needsRestart === true) report.needsRestart = true
            }
          }
          const failures = [
            ...Object.values(report.shortcuts).filter((r) => r?.ok === false),
            ...Object.values(report.application).filter((r) => r?.ok === false),
          ]
          if (failures.length > 0) report.ok = false
          await writeState({ lastRestoredAt: Date.now(), lastIcon: '' })
          writeJson(res, report.ok ? 200 : 500, report)
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/library',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        try { writeJson(res, 200, { ok: true, entries: await listLibrary(), dir: libraryDir() }) } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/library/add',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        if (!requirePost(req, res)) return
        const body = await readJsonBody(req, MAX_UPLOAD_BYTES)
        if (body.tooLarge) { writeJson(res, 413, { ok: false, error: '图标过大（上限 8 MB）' }); return }
        const input = typeof body.value === 'object' && body.value !== null ? body.value : {}
        const source = await resolveSource(input)
        if (!source.ok) { writeJson(res, 400, source); return }
        const result = await addToLibrary(source.path, input.name)
        writeJson(res, result.ok ? 200 : 400, result)
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/library/remove',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        if (!requirePost(req, res)) return
        const body = await readJsonBody(req)
        const input = typeof body.value === 'object' && body.value !== null ? body.value : {}
        const result = await removeFromLibrary(input.file)
        writeJson(res, result.ok ? 200 : 400, result)
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/upload',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        if (!requirePost(req, res)) return
        const body = await readJsonBody(req, MAX_UPLOAD_BYTES)
        if (body.tooLarge) { writeJson(res, 413, { ok: false, error: '图标过大（上限 8 MB）' }); return }
        const input = typeof body.value === 'object' && body.value !== null ? body.value : {}
        const result = await storeUpload(input)
        writeJson(res, result.ok ? 200 : 400, result)
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/restart',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        if (!requirePost(req, res)) return
        writeJson(res, 200, {
          ok: true,
          mode: isDesktopHost() ? 'shell-dialog' : 'manual',
          hint: restartExplanation(),
        })
        scheduleExit(ctx)
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/exit',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        if (!requirePost(req, res)) return
        writeJson(res, 200, { ok: true })
        scheduleExit(ctx)
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-icon-console/settings',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        const current = await resolveConfig(ctx, fallback)
        if ((req.method ?? 'GET') === 'GET') { writeJson(res, 200, { ok: true, settings: current }); return }
        if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: 'method not allowed' }); return }
        const body = await readJsonBody(req)
        if (body.invalid || typeof body.value !== 'object' || body.value === null) {
          writeJson(res, 400, { ok: false, error: 'invalid JSON body' }); return
        }
        try {
          // The Host owns volatile field persistence; this plugin keeps its own
          // copy so the console works even where the settings surface is absent.
          const next = await writeState(body.value)
          const settings = ctx.get('settings')
          if (settings !== undefined && typeof settings.update === 'function') {
            try { await settings.update(SETTINGS_NS, body.value) } catch { /* local state still wins */ }
          }
          writeJson(res, 200, { ok: true, settings: { ...(await resolveConfig(ctx, fallback)), ...next } })
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
  ]
}

export function apply(ctx, config) {
  // The composition layer arrives with volatile references; unwrap before use.
  const fallback = unwrapConfig({ ...CONFIG_DEFAULTS, ...config })

  // The Host owns the settings surface: this entry's volatile Config fields are
  // projected into the plugin page's form by the Host itself, and writes go
  // through SettingsForms.update(entryId, patch). `auto: false` keeps this
  // entry out of any schema-generated page, because the bundle ships its own
  // form (the settings card rendered by the client half).
  ctx.inject(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings
    if (settings !== undefined && typeof settings.configure === 'function') {
      settingsCtx.effect(() => settings.configure({ auto: false }, ctx.fiber))
    }
  })

  // Register the routes inside the effect so cordis owns disposal.
  ctx.effect(() => {
    const disposers = makeRoutes(ctx, fallback).map((route) => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) {
        try { dispose() } catch { /* route fiber gone during shutdown */ }
      }
    }
  }, 'dsh-icon-console: routes')

  // Best-effort: remember the pristine application icons the first time the
  // plugin runs, so "restore official" always has a trustworthy source.
  void (async () => {
    try {
      await ensureStateDirs()
      await ensureIconBackup()
    } catch (error) {
      console.error('[dsh-icon-console] icon backup failed:', error instanceof Error ? error.message : error)
    }
  })()
}
