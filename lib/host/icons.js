// dsh-icon-console host icon helpers.
//
// Icon targets on the DSH desktop application:
//   1. Shortcut icons  — Desktop / Start Menu `.lnk` files. Changing
//      `IconLocation` via WScript.Shell takes effect immediately for the
//      shell (Explorer refreshes the link icon on its own schedule), no
//      application restart needed.
//   2. Application icons — `<install>/resources/icon.png` (window/taskbar)
//      and `<install>/resources/tray.ico` (system tray). Electron reads these
//      once at startup, so replacing them requires an application restart.
//
// Everything here is plain ESM with no dependency on internal dsh modules.
// @module dsh-icon-console/host/icons

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, extname, join } from 'node:path'

/** Icon formats accepted as an import source. */
export const ACCEPTED_EXTENSIONS = ['.ico', '.png']

/** Windows Shell Link binary icon-carrying targets, in application order. */
export const SHORTCUT_TARGETS = ['desktop', 'startMenu']

/**
 * Resolve the DSH home directory (the `~/.dsh` root).
 * @returns the absolute home path.
 */
export function resolveDshHome() {
  const raw = process.env.DSH_HOME
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()
  return join(homedir(), '.dsh')
}

/** Where this plugin keeps its own state (icon library, backups, logs). */
export function consoleStateDir() {
  return join(resolveDshHome(), 'icon-console')
}

/** Backup directory holding the pristine application icons. */
export function backupDir() {
  return join(consoleStateDir(), 'backup')
}

/** User icon library directory (每套图标一个文件). */
export function libraryDir() {
  return join(consoleStateDir(), 'library')
}

/** Where the persisted console settings live. */
export function stateFile() {
  return join(consoleStateDir(), 'state.json')
}

/**
 * Locate the DSH desktop installation root (the directory holding
 * `resources/` and the application executable).
 *
 * Resolution order:
 *   1. `DSH_DESKTOP_INSTALL` override.
 *   2. Walk up from `process.execPath` (the Electron binary when the host runs
 *      as a child of the desktop app).
 *   3. Well-known per-user install location.
 * @returns the install root, or undefined when it cannot be determined.
 */
export function resolveInstallRoot() {
  const override = process.env.DSH_DESKTOP_INSTALL
  if (typeof override === 'string' && override.trim() !== '' && existsSync(override.trim())) return override.trim()

  // process.execPath is `<install>\DeepSeek Harness.exe` for the desktop host.
  const exe = process.execPath
  if (typeof exe === 'string' && exe !== '' && /DeepSeek Harness\.exe$/i.test(exe)) {
    const dir = join(exe, '..')
    if (existsSync(join(dir, 'resources'))) return dir
  }

  const fallback = join(homedir(), 'AppData', 'Local', 'Programs', 'DeepSeek Harness')
  if (existsSync(join(fallback, 'resources'))) return fallback
  return undefined
}

/** The application resources directory, or undefined. */
export function resourcesDir() {
  const root = resolveInstallRoot()
  return root === undefined ? undefined : join(root, 'resources')
}

/** Absolute path of the shortcut for one target id, or undefined. */
export function shortcutPath(target) {
  const profile = process.env.USERPROFILE ?? homedir()
  const appData = process.env.APPDATA ?? join(profile, 'AppData', 'Roaming')
  const name = 'DeepSeek Harness.lnk'
  switch (target) {
    case 'desktop': return join(profile, 'Desktop', name)
    case 'startMenu': return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', name)
    default: return undefined
  }
}

/** Human label for a shortcut target (used in status payloads). */
export function shortcutLabel(target) {
  switch (target) {
    case 'desktop': return '桌面快捷方式'
    case 'startMenu': return '开始菜单快捷方式'
    default: return target
  }
}

/** Validate an icon source file: existence, extension and non-emptiness. */
export async function inspectIconSource(path) {
  if (typeof path !== 'string' || path.trim() === '') return { ok: false, error: '未提供图标路径' }
  const resolved = path.trim()
  if (!existsSync(resolved)) return { ok: false, error: `文件不存在: ${resolved}` }
  const ext = extname(resolved).toLowerCase()
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `不支持的格式 ${ext}（仅支持 ${ACCEPTED_EXTENSIONS.join(' / ')}）` }
  }
  const info = await stat(resolved)
  if (!info.isFile()) return { ok: false, error: '不是一个文件' }
  if (info.size === 0) return { ok: false, error: '图标文件为空' }
  if (ext === '.png') {
    const head = await readFile(resolved).then((buf) => buf.subarray(0, 8))
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if (!head.equals(pngSignature)) return { ok: false, error: 'PNG 文件头无效（文件可能已损坏）' }
  }
  return { ok: true, path: resolved, ext, size: info.size }
}

/** Ensure the plugin's state directories exist. */
export async function ensureStateDirs() {
  await mkdir(consoleStateDir(), { recursive: true })
  await mkdir(backupDir(), { recursive: true })
  await mkdir(libraryDir(), { recursive: true })
}

/**
 * Back up the pristine application icons once, so "restore official" has a
 * trustworthy source even after several replacements.
 * @returns the map of backed-up files.
 */
export async function ensureIconBackup() {
  await ensureStateDirs()
  const resources = resourcesDir()
  const files = {}
  if (resources === undefined) return files
  for (const name of ['icon.png', 'tray.ico']) {
    const source = join(resources, name)
    const target = join(backupDir(), name)
    if (existsSync(source) && !existsSync(target)) {
      await copyFile(source, target)
    }
    files[name] = existsSync(target) ? target : undefined
  }
  return files
}

/**
 * Replace one application icon file (`resources/icon.png` or
 * `resources/tray.ico`). Requires a restart to take effect; the pristine copy
 * is backed up first.
 * @param name - `icon.png` or `tray.ico`.
 * @param source - the icon file to install.
 * @returns a result describing what was written.
 */
export async function applyApplicationIcon(name, source) {
  if (name !== 'icon.png' && name !== 'tray.ico') return { ok: false, error: `未知的应用图标: ${name}` }
  const resources = resourcesDir()
  if (resources === undefined) return { ok: false, error: '未找到 DSH 桌面端安装目录（可用 DSH_DESKTOP_INSTALL 指定）' }
  const inspected = await inspectIconSource(source)
  if (!inspected.ok) return inspected
  await ensureIconBackup()
  const target = join(resources, name)
  try {
    await copyFile(inspected.path, target)
  } catch (error) {
    return { ok: false, error: `写入失败: ${error instanceof Error ? error.message : String(error)}` }
  }
  return { ok: true, path: target, bytes: inspected.size, needsRestart: true }
}

/** Restore one application icon from the pristine backup. */
export async function restoreApplicationIcon(name) {
  if (name !== 'icon.png' && name !== 'tray.ico') return { ok: false, error: `未知的应用图标: ${name}` }
  const resources = resourcesDir()
  const backup = join(backupDir(), name)
  if (resources === undefined) return { ok: false, error: '未找到 DSH 桌面端安装目录' }
  if (!existsSync(backup)) return { ok: false, error: `没有 ${name} 的官方备份` }
  try {
    await copyFile(backup, join(resources, name))
  } catch (error) {
    return { ok: false, error: `还原失败: ${error instanceof Error ? error.message : String(error)}` }
  }
  return { ok: true, path: join(resources, name), needsRestart: true }
}

/** Read one shortcut's current IconLocation. */
export function readShortcutIcon(lnkPath) {
  return new Promise((resolve) => {
    if (!existsSync(lnkPath)) { resolve({ ok: false, error: '快捷方式不存在' }); return }
    const script = [
      "$ws = New-Object -ComObject WScript.Shell",
      `$sc = $ws.CreateShortcut(${psQuote(lnkPath)})`,
      'Write-Output $sc.IconLocation',
    ].join('; ')
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15000 }, (error, stdout) => {
      if (error) { resolve({ ok: false, error: error.message }); return }
      resolve({ ok: true, iconLocation: String(stdout).trim() })
    })
  })
}

/**
 * Point one shortcut at an icon file. Immediate for the shell.
 * @param lnkPath - the shortcut to edit.
 * @param iconPath - the `.ico` file, or undefined to restore the executable's
 *   own embedded icon (`<exe>,0`).
 * @returns a result describing the write.
 */
export function writeShortcutIcon(lnkPath, iconPath) {
  return new Promise((resolve) => {
    if (!existsSync(lnkPath)) { resolve({ ok: false, error: '快捷方式不存在' }); return }
    if (iconPath !== undefined && !existsSync(iconPath)) { resolve({ ok: false, error: `图标文件不存在: ${iconPath}` }); return }
    const value = iconPath === undefined ? undefined : `${iconPath},0`
    const lines = [
      '$ErrorActionPreference = "Stop"',
      '$ws = New-Object -ComObject WScript.Shell',
      `$sc = $ws.CreateShortcut(${psQuote(lnkPath)})`,
      value === undefined
        ? '$exe = $sc.TargetPath; $sc.IconLocation = "$exe,0"'
        : `$sc.IconLocation = ${psQuote(value)}`,
      '$sc.Save()',
      'Write-Output $sc.IconLocation',
    ]
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', lines.join('; ')], { windowsHide: true, timeout: 15000 }, (error, stdout) => {
      if (error) { resolve({ ok: false, error: error.message }); return }
      resolve({ ok: true, iconLocation: String(stdout).trim() })
    })
  })
}

/**
 * Apply an icon across the requested scope.
 * @param options - { source, shortcuts: string[], application: string[] }
 * @returns a per-target report.
 */
export async function applyIcon(options) {
  const { source } = options
  const shortcuts = Array.isArray(options.shortcuts) ? options.shortcuts : []
  const application = Array.isArray(options.application) ? options.application : []
  const inspected = await inspectIconSource(source)
  if (!inspected.ok) return { ok: false, error: inspected.error }

  // Windows shortcuts require a .ico file; a .png can still be installed as
  // the window/tray image, so the two scopes fail independently.
  const shortcutExtOk = inspected.ext === '.ico'
  const report = { ok: true, shortcuts: {}, application: {}, needsRestart: application.length > 0 }

  for (const target of shortcuts) {
    const lnk = shortcutPath(target)
    if (lnk === undefined) { report.shortcuts[target] = { ok: false, error: '未知目标' }; continue }
    if (!shortcutExtOk) { report.shortcuts[target] = { ok: false, error: '快捷方式图标需要 .ico 文件（.png 仅可用于应用/托盘图标）' }; continue }
    report.shortcuts[target] = await writeShortcutIcon(lnk, inspected.path)
  }

  for (const name of application) {
    report.application[name] = await applyApplicationIcon(name, inspected.path)
  }

  const failures = [
    ...Object.values(report.shortcuts).filter((r) => !r.ok),
    ...Object.values(report.application).filter((r) => !r.ok),
  ]
  if (failures.length > 0) report.ok = false
  return report
}

/** Restore every shortcut to the executable's own icon. */
export async function restoreShortcuts() {
  const report = {}
  for (const target of SHORTCUT_TARGETS) {
    const lnk = shortcutPath(target)
    if (lnk === undefined) continue
    if (!existsSync(lnk)) { report[target] = { ok: true, skipped: '快捷方式不存在' }; continue }
    report[target] = await writeShortcutIcon(lnk, undefined)
  }
  return report
}

/** Icon-library entries (one named icon per file). */
export async function listLibrary() {
  await ensureStateDirs()
  const entries = []
  let names
  try { names = await readdir(libraryDir()) } catch { names = [] }
  for (const name of names) {
    if (!ACCEPTED_EXTENSIONS.includes(extname(name).toLowerCase())) continue
    const full = join(libraryDir(), name)
    const info = await stat(full).catch(() => undefined)
    if (info === undefined || !info.isFile()) continue
    entries.push({ name: basename(name, extname(name)), file: name, path: full, bytes: info.size, ext: extname(name).toLowerCase() })
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  return entries
}

/** Copy an icon into the library under a friendly name. */
export async function addToLibrary(source, name) {
  const inspected = await inspectIconSource(source)
  if (!inspected.ok) return inspected
  await ensureStateDirs()
  const safe = String(name ?? '').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 64)
  const stem = safe === '' ? `icon-${Date.now()}` : safe
  const target = join(libraryDir(), `${stem}${inspected.ext}`)
  try {
    await copyFile(inspected.path, target)
  } catch (error) {
    return { ok: false, error: `写入图标库失败: ${error instanceof Error ? error.message : String(error)}` }
  }
  return { ok: true, name: stem, path: target, ext: inspected.ext, bytes: inspected.size }
}

/** Remove one library entry (by file name). */
export async function removeFromLibrary(file) {
  const target = join(libraryDir(), basename(String(file ?? '')))
  if (!existsSync(target)) return { ok: false, error: '图标不存在' }
  try { await rm(target, { force: true }) } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  return { ok: true }
}

/** Current icon state, for the status payload. */
export async function describeState() {
  const resources = resourcesDir()
  const shortcuts = {}
  for (const target of SHORTCUT_TARGETS) {
    const lnk = shortcutPath(target)
    if (lnk === undefined) continue
    const exists = existsSync(lnk)
    const read = exists ? await readShortcutIcon(lnk) : { ok: false }
    shortcuts[target] = {
      label: shortcutLabel(target),
      path: lnk,
      exists,
      iconLocation: read.ok ? read.iconLocation : undefined,
      custom: read.ok ? !/,0$/.test(read.iconLocation ?? '') : false,
    }
  }
  const application = {}
  for (const name of ['icon.png', 'tray.ico']) {
    const live = resources === undefined ? undefined : join(resources, name)
    const backup = join(backupDir(), name)
    let liveBytes
    let liveModified
    if (live !== undefined && existsSync(live)) {
      const info = await stat(live)
      liveBytes = info.size
      liveModified = info.mtimeMs
    }
    let backupBytes
    if (existsSync(backup)) backupBytes = (await stat(backup)).size
    application[name] = {
      livePath: live,
      exists: live !== undefined && existsSync(live),
      bytes: liveBytes,
      modified: liveModified,
      backupPath: existsSync(backup) ? backup : undefined,
      backupBytes,
      // A size difference against the pristine copy is the cheap, robust
      // signal that the file was replaced (timestamps move on every install).
      custom: liveBytes !== undefined && backupBytes !== undefined && liveBytes !== backupBytes,
    }
  }
  return {
    installRoot: resolveInstallRoot(),
    resources,
    stateDir: consoleStateDir(),
    restored: await readState(),
    shortcuts,
    application,
  }
}

/** Persist the plugin's own state document. */
export async function writeState(patch) {
  await ensureStateDirs()
  const current = await readState()
  const next = { ...current, ...patch }
  await writeFile(stateFile(), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

/** Read the plugin's own state document. */
export async function readState() {
  try {
    const raw = await readFile(stateFile(), 'utf8')
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/** Single-quote a value for PowerShell. */
function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}
