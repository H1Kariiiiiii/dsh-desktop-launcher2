// dsh-icon-console host process control: graceful exit and restart.
//
// Desktop architecture (0.2.0-rc.2), verified by inspecting the packaged
// Electron application:
//
//   DeepSeek Harness.exe (Electron main)
//     └─ spawns  <electron> dsh-desktop-host/lib/index.js   (this process)
//          └─ runProfile({ profile: 'desktop', args: ['--no-open','--port','19387'] })
//
// The Electron main process owns the window and the application lifecycle.
// Plugins run inside the host child, so a plugin can end the HOST, and the
// shell reacts:
//
//   * Electron watches the host child. An unexpected exit raises the shell's
//     fatal-error dialog whose buttons are [退出应用] [重启] [禁用第三方插件…].
//     "重启" calls app.relaunch() + quitWithoutConfirmation(), i.e. the
//     official, lifecycle-correct restart.
//   * Relaunching the Electron process ourselves would bypass the shell's
//     launcher lifecycle — the same reason dsh-market hard-codes
//     allowRestart: false under a desktop host.
//
// So "restart" here means: request a bounded host exit, and let the shell's
// own recovery dialog complete the relaunch. The dialog is the shell's, and
// its default button is 重启, so one Enter finishes the restart.
// @module dsh-icon-console/host/restart

/** Milliseconds to let the HTTP response drain before the exit lands. */
export const EXIT_DELAY_MS = 120

/**
 * Request a bounded process exit through the launcher-provided `ctx.appExit`,
 * falling back to `process.exit` when the launcher did not provide one.
 * @param ctx - host plugin context.
 * @param code - process exit code.
 * @returns how the exit was requested.
 */
export function requestExit(ctx, code = 0) {
  const exit = ctx.get('appExit')
  if (typeof exit === 'function') {
    exit(code)
    return 'appExit'
  }
  process.exit(code)
  return 'process.exit'
}

/**
 * Schedule a bounded exit after a short beat so the HTTP response the caller
 * is waiting for reaches the browser first.
 * @param ctx - host plugin context.
 * @param delay - milliseconds to wait before exiting.
 * @returns an object describing what was scheduled.
 */
export function scheduleExit(ctx, delay = EXIT_DELAY_MS) {
  const timer = setTimeout(() => { requestExit(ctx, 0) }, delay)
  if (typeof timer.unref === 'function') timer.unref()
  return { scheduled: true, delayMs: delay }
}

/**
 * Whether this host is running under the DSH desktop shell. Used only for
 * reporting; the exit path is identical either way.
 * @returns true when the desktop host markers are present.
 */
export function isDesktopHost() {
  if (process.env.DSH_DESKTOP_NODE_EXECUTABLE !== undefined) return true
  if (process.env.DSH_CLIENT_VERSION !== undefined) return true
  return /DeepSeek Harness\.exe$/i.test(process.execPath ?? '')
}

/**
 * Describe what a restart will do, so the UI can set expectations honestly
 * (the shell, not this plugin, relaunches the window).
 * @returns a user-facing description.
 */
export function restartExplanation() {
  return isDesktopHost()
    ? '将结束当前 Host 进程，桌面端随后弹出恢复对话框——点「重启」即可重新启动应用（默认按钮就是重启，直接回车即可）。'
    : '将结束当前 dsh 进程；请手动重新启动。'
}
