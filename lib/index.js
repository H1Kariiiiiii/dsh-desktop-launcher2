// dsh-desktop-launcher2 host entry (rc.1): desktop launcher + one-click
// shutdown, ported from @linxin666/dsh-desktop-launcher 0.2.8 (Apache-2.0)
// to plain ESM JS with the official rc.1 services (ctx.settings for the
// desktop-launcher settings namespace, ctx.appExit for bounded exit).
//
// Routes (all loopback-only):
//   GET  /api/dsh-desktop-launcher2/status      — shortcut state + dsh probe
//   POST /api/dsh-desktop-launcher2/install     — write launcher + .lnk icon
//   POST /api/dsh-desktop-launcher2/shutdown    — bounded host exit
//   GET  /api/dsh-desktop-launcher2/settings    — read the settings namespace
//   POST /api/dsh-desktop-launcher2/settings    — write the settings namespace
// @module dsh-desktop-launcher2

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from 'schemastery'
import {
  DEFAULT_DSH_COMMAND,
  DEFAULT_URL,
  desktopFileName,
  renderDesktopEntry,
  renderLauncherScript,
  renderShortcutInstaller,
  scriptFileName,
} from './host/state.js'

export const name = 'dsh-desktop-launcher2'

/** Services required before the launcher surfaces can mount. */
export const inject = ['webServer']

/**
 * Settings namespace of the desktop-launcher capability — the section the
 * web settings surface edits. Spelled here (importable by both halves).
 */
export const SETTINGS_NS = 'desktop-launcher'

/** Plugin config defaults (no Config export: defaults live in apply). */
const CONFIG_DEFAULTS = {
  /** Master switch for the plugin. */
  enabled: true,
  /** Whether the host announces the plugin to every agent. */
  announceToAgent: false,
  /** Command that starts dsh (must be on PATH when the launcher runs). */
  dshCommand: DEFAULT_DSH_COMMAND,
  /** Base URL of the dsh web GUI. */
  url: DEFAULT_URL,
  /** Optional profile passed as `dsh web --profile <profile>`. */
  profile: '',
  /** Optional icon file (.ico/.png); empty uses the bundled dsh icon. */
  iconPath: '',
  /** Whether the floating shutdown button asks for confirmation before exiting. */
  confirmShutdown: true,
}

/** The schemastery schema for the `desktop-launcher` settings namespace. */
export const SettingsSchema = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(false),
  dshCommand: z.string().default(DEFAULT_DSH_COMMAND),
  url: z.string().default(DEFAULT_URL),
  profile: z.string().default(''),
  iconPath: z.string().default(''),
  confirmShutdown: z.boolean().default(true),
})

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 210

/** Model-facing announcement: plugin presence, capabilities, and limits. */
const GUIDANCE = '本机已安装 dsh-desktop-launcher2 插件（DSH 桌面启动器 + 一键关机）：设置 → 桌面启动器 卡片内「创建桌面图标」可在桌面生成一键启动图标（Windows .lnk / macOS .command / Linux .desktop），双击即启动 dsh web 并打开 Web GUI；可配置 dshCommand / url / profile / iconPath。界面右下角还有关机样式浮动按钮，点击弹出确认框，确认后请求宿主进程优雅退出（经 ctx.appExit，先回收插件树再退出）。限制：图标创建与关机路由均仅限 loopback，退出会终止 dsh web 进程，正在运行的会话/任务可能中断。用户提到「桌面图标 / 快捷方式 / 一键启动 dsh / 关机 / 退出 DSH / 关闭 DeepSeek Harness」时即指本插件，请据此协作。'

/** Resolve live config: the composition `base` layer from the settings scope. */
function resolveConfig(ctx, fallback) {
  const scope = ctx.get('settings')
  if (scope === undefined) return fallback
  const value = scope.get(SETTINGS_NS)
  return value === undefined || value === null ? fallback : { ...CONFIG_DEFAULTS, ...value }
}

/** The dsh icon bundled with the package (assets/dsh.ico next to lib/index.js). */
let bundledIconPath
let bundledPngPath
try { bundledIconPath = fileURLToPath(new URL('../assets/dsh.ico', import.meta.url)) } catch { bundledIconPath = undefined }
try { bundledPngPath = fileURLToPath(new URL('../assets/dsh.png', import.meta.url)) } catch { bundledPngPath = undefined }

/** Resolve the icon source: configured iconPath, then the bundled icon. */
function resolveIconSource(spec) {
  if (spec.iconPath !== undefined && spec.iconPath !== '' && existsSync(spec.iconPath)) return spec.iconPath
  if (bundledIconPath !== undefined && existsSync(bundledIconPath)) return bundledIconPath
  return undefined
}

/** Runners: execFile with a 30s cap, reporting exit code and stderr. */
const execFileAsync = (file, args) => new Promise((resolve) => {
  execFile(file, args, { timeout: 30_000, windowsHide: true }, (err) => {
    resolve(err ? { code: typeof err.code === 'number' ? err.code : 1, stderr: err.message } : { code: 0, stderr: '' })
  })
})

/** Narrow a raw platform string to the supported set. */
function toPlatform(platform) {
  if (platform === 'win32' || platform === 'darwin' || platform === 'linux') return platform
  throw new Error(`unsupported platform: ${platform}`)
}

/**
 * Desktop directory: the standard Desktop, with the OneDrive redirect
 * fallback on Windows when the plain path does not exist.
 */
function resolveDesktopDir(home, platform) {
  const desktop = join(home, 'Desktop')
  if (platform === 'win32' && !existsSync(desktop)) {
    const onedrive = join(home, 'OneDrive', 'Desktop')
    if (existsSync(onedrive)) return onedrive
  }
  return desktop
}

/** Best-effort dsh command probe (never throws). */
async function probeDsh(platform, dshCommand) {
  if (isAbsolute(dshCommand) || dshCommand.includes('/') || dshCommand.includes('\\')) {
    return existsSync(dshCommand)
  }
  try {
    const result = platform === 'win32'
      ? await execFileAsync('where', [dshCommand])
      : await execFileAsync('sh', ['-lc', `command -v ${dshCommand}`])
    return result.code === 0
  } catch {
    return false
  }
}

/**
 * Write the launcher script and place the desktop icon for the current
 * platform. Refreshing is idempotent: rerunning overwrites both files.
 * @param ctx - host context (for config resolution).
 * @param fallback - fallback config (apply defaults).
 * @returns { ok, path, platform, warning? } or { ok:false, error }.
 */
export async function createDesktopShortcut(ctx, fallback) {
  const spec = resolveConfig(ctx, fallback)
  const platform = toPlatform(process.platform)
  const home = homedir()
  const scriptsDir = join(process.env.DSH_HOME && process.env.DSH_HOME.trim() !== '' ? process.env.DSH_HOME : join(home, '.dsh'), 'desktop-launcher')
  await mkdir(scriptsDir, { recursive: true })
  const launcherPath = join(scriptsDir, scriptFileName(platform))
  // UTF-8 BOM: Windows PowerShell 5.1 misreads the Chinese popup text without it.
  await writeFile(launcherPath, '\uFEFF' + renderLauncherScript(platform, spec), { mode: 0o755 })
  // Copy the icons next to the launcher so the shortcut keeps working even if
  // the source package moves: windows uses dsh.ico as the .lnk icon, the
  // startup popup and linux use dsh.png when available.
  let iconIco
  let iconPng
  const iconSource = resolveIconSource(spec)
  if (iconSource !== undefined) {
    iconIco = join(scriptsDir, 'dsh.ico')
    await copyFile(iconSource, iconIco)
    if (/\.png$/i.test(iconSource)) {
      iconPng = join(scriptsDir, 'dsh.png')
      await copyFile(iconSource, iconPng)
    } else if (bundledPngPath !== undefined && existsSync(bundledPngPath)) {
      iconPng = join(scriptsDir, 'dsh.png')
      await copyFile(bundledPngPath, iconPng)
    }
  }
  const desktopDir = resolveDesktopDir(home, platform)
  await mkdir(desktopDir, { recursive: true })
  const iconPath = join(desktopDir, desktopFileName(platform))
  let warning
  const dshFound = await probeDsh(platform, spec.dshCommand)
  if (!dshFound) warning = `dsh command "${spec.dshCommand}" was not found on PATH; the launcher shows a message when run`
  if (platform === 'win32') {
    const installerPath = join(scriptsDir, 'install-shortcut.ps1')
    // The installer embeds user paths and may contain non-ASCII characters;
    // Windows PowerShell 5.1 requires a BOM to decode it as UTF-8.
    await writeFile(installerPath, '\uFEFF' + renderShortcutInstaller({
      launcherPath,
      desktopPath: iconPath,
      homeDir: home,
      iconLocation: iconIco ?? 'powershell.exe,0',
    }))
    const result = await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installerPath])
    if (result.code !== 0) throw new Error(`shortcut creation failed: ${result.stderr}`)
  } else if (platform === 'darwin') {
    await writeFile(iconPath, renderLauncherScript(platform, spec), { mode: 0o755 })
  } else {
    await writeFile(iconPath, renderDesktopEntry(launcherPath, iconPng ?? iconIco), { mode: 0o755 })
    await chmod(launcherPath, 0o755)
    const trust = await execFileAsync('gio', ['set', iconPath, 'metadata::trusted', 'true'])
    if (trust.code !== 0) warning = `desktop entry created but not marked trusted: ${trust.stderr}`
  }
  return { ok: true, path: iconPath, platform, ...(warning === undefined ? {} : { warning }) }
}

/** Truthy shortcut state probe for the status route. */
export function shortcutState() {
  const platform = toPlatform(process.platform)
  const home = homedir()
  const desktopDir = resolveDesktopDir(home, platform)
  return { exists: existsSync(join(desktopDir, desktopFileName(platform))), path: join(desktopDir, desktopFileName(platform)) }
}

/** Loopback trust fence (socket address + host header + same-origin markers). */
function isLoopbackAddress(address) {
  if (address === undefined) return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.slice('::ffff:'.length)
    const parts = v4.split('.')
    return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  }
  const parts = normalized.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  return isLoopbackAddress(hostname)
}

function isLoopbackRequest(request) {
  if (!isLoopbackAddress(request.socket.remoteAddress)) return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl
  try {
    hostUrl = new URL('http://' + host)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** One JSON response. */
function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(JSON.stringify(body))
}

/** Read request body as JSON (empty body → undefined). */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      if (data === '') { resolve(undefined); return }
      try { resolve(JSON.parse(data)) } catch { resolve(undefined) }
    })
    req.on('error', () => { resolve(undefined) })
  })
}

/** Build the route family bound to live config. */
function makeRoutes(ctx, fallback) {
  return [
    {
      kind: 'exact',
      path: '/api/dsh-desktop-launcher2/status',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        const state = shortcutState()
        const spec = resolveConfig(ctx, fallback)
        const dshFound = await probeDsh(toPlatform(process.platform), spec.dshCommand)
        writeJson(res, 200, {
          ok: true,
          shortcutExists: state.exists,
          shortcutPath: state.path,
          dshPresent: dshFound,
          dshCmd: spec.dshCommand,
          launcherPath: join(process.env.DSH_HOME && process.env.DSH_HOME.trim() !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh'), 'desktop-launcher'),
        })
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-desktop-launcher2/install',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        if ((req.method ?? 'GET') !== 'POST') { writeJson(res, 405, { ok: false, error: 'method not allowed' }); return }
        try {
          writeJson(res, 200, { result: await createDesktopShortcut(ctx, fallback) })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-desktop-launcher2/shutdown',
      handler: async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' }); res.end('method not allowed'); return }
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden' }); return }
        writeJson(res, 200, { ok: true })
        // Flush first: the browser must see the acknowledgement before the
        // process is gone. The beat also lets the response socket drain.
        setTimeout(() => {
          const exit = ctx.get('appExit')
          if (exit !== undefined) exit(0)
          else process.exit(0)
        }, 80)
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-desktop-launcher2/settings',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) { writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' }); return }
        const settings = ctx.get('settings')
        const current = resolveConfig(ctx, fallback)
        if (req.method === 'GET') {
          writeJson(res, 200, { ok: true, settings: current })
          return
        }
        if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: 'method not allowed' }); return }
        if (settings === undefined) { writeJson(res, 500, { ok: false, error: 'settings service unavailable' }); return }
        const body = await readJsonBody(req)
        if (body === undefined || typeof body !== 'object' || body === null) { writeJson(res, 400, { ok: false, error: 'invalid JSON body' }); return }
        try {
          // Lazy-register safeguard: if the plugin mounted before the
          // settings provider (bundle order) the namespace may still be
          // absent, yet the provider is available now.
          if (settings.get(SETTINGS_NS) === undefined) {
            settings.register(SETTINGS_NS, SettingsSchema, { base: fallback, applies: 'live' })
          }
          // Merge like the settings-service patch: only provided fields change.
          await settings.update(SETTINGS_NS, body)
          writeJson(res, 200, { ok: true, settings: resolveConfig(ctx, fallback) })
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
  ]
}

export function apply(ctx, config) {
  const fallback = { ...CONFIG_DEFAULTS, ...config }

  // Register the settings namespace so the settings surface knows this
  // capability (the composition entry config is the base layer). The
  // configurable-plugins tab dispatches cards by settings namespace, so the
  // registration MUST land before the settings page queries namespaces.
  // Uses the SAME installSection pattern as dsh-free-search (verified
  // working): a waiting inject that installs the section once the settings
  // provider is available, with the composition entry as the base layer.
  ctx.inject(['settings'], (settingsCtx) => {
    const sctx = settingsCtx
    if (typeof sctx.settings.installSection === 'function') {
      sctx.settings.installSection(ctx, SETTINGS_NS, SettingsSchema, fallback, {
        setSource: () => {},
        onChange: () => {},
      })
    } else {
      // Fallback for providers without installSection: register directly
      // (guard against a duplicate — installSection not available implies
      // the simple register contract).
      if (sctx.settings.get(SETTINGS_NS) === undefined) {
        sctx.settings.register(SETTINGS_NS, SettingsSchema, { base: fallback, applies: 'live' })
      }
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
  }, 'dsh-desktop-launcher2: routes')

  // Optional system-prompt announcement (fixed at mount from the resolved
  // config; the settings surface changes take effect next boot).
  if ((fallback.announceToAgent ?? false) === true) {
    const systemPrompt = ctx.get('systemPrompt')
    if (systemPrompt !== undefined) {
      ctx.effect(() => systemPrompt.section({
        name: 'plugin:dsh-desktop-launcher2',
        order: SECTION_ORDER,
        text: GUIDANCE,
      }), 'dsh-desktop-launcher2: announcement')
    }
  }
}
