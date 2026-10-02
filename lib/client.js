// dsh-icon-console client bundle.
//
// One settings-page card (the `settings.section` list slot, the same slot the
// official sections and third-party cards such as wallpaper-engine use):
//   * shows the current icon state for every target
//     (桌面快捷方式 / 开始菜单快捷方式 / 应用窗口图标 / 系统托盘图标)
//   * imports an icon from the file picker (uploaded as base64 — a web view
//     cannot reveal a native path) or from a path typed by the user
//   * applies it to the chosen scope, saves it to the icon library, and
//     restores the official icons
//   * restarts or exits the application through the loopback control routes
//
// Bundle format: lazy-CJS factory registered through window.__ModuleLoader__
// (combo scripts are classic <script> tags, so a plain ESM `export` would
// SyntaxError in the browser). Only `react` is required (a platform seed
// word). The window guard keeps a bare Node import (self-check) free of side
// effects.
// @module dsh-icon-console/client

if (typeof window !== 'undefined' && typeof window.__ModuleLoader__ !== 'undefined') {
  window.__ModuleLoader__.load({
    id: 'dsh-icon-console',
    factory: (require) => {
      var module = { exports: {} }
      var exports = module.exports

      var React = require('react')

      var BASE = '/api/dsh-icon-console'

      // ---------------------------------------------------------------- CSS
      var CSS_TEXT = [
        '.dsic-card{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-3,transparent);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}',
        '.dsic-card:hover{border-color:var(--dsw-alias-label-dimmed,rgba(128,128,128,.6))}',
        '.dsic-cardOpen{background:var(--dsw-alias-bg-layer-2,transparent);border-color:var(--dsw-alias-label-dimmed,rgba(128,128,128,.6))}',
        '.dsic-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}',
        '.dsic-headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}',
        '.dsic-name{color:var(--dsw-alias-label-primary,inherit);font-size:15px;font-weight:600;line-height:1.4}',
        '.dsic-description{color:var(--dsw-alias-label-tertiary,inherit);font-size:13px;line-height:1.5}',
        '.dsic-chevron{color:var(--dsw-alias-label-tertiary,inherit);flex:none;transition:transform .16s}',
        '.dsic-chevronOpen{transform:rotate(180deg)}',
        '.dsic-body{border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));margin:0 16px;padding:4px 0 12px}',
        '.dsic-section{margin:14px 0 6px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
        '.dsic-hint{color:var(--dsw-alias-label-tertiary,inherit);margin:0;font-size:12px;line-height:1.6}',
        '.dsic-error{color:var(--dsw-alias-label-error,#e05555);margin:6px 0 0;font-size:12px;line-height:1.6;word-break:break-all}',
        '.dsic-ok{color:#7ddb9c;margin:6px 0 0;font-size:12px;line-height:1.6;word-break:break-all}',
        '.dsic-warn{color:var(--dsw-alias-state-warn-primary,#e0a000);margin:6px 0 0;font-size:12px;line-height:1.6}',
        '.dsic-row{align-items:center;gap:10px;padding:7px 0;display:flex;flex-wrap:wrap}',
        '.dsic-rowLabel{color:var(--dsw-alias-label-primary,inherit);flex:1;min-width:150px;font-size:13px}',
        '.dsic-rowState{color:var(--dsw-alias-label-tertiary,inherit);font-size:12px;font-variant-numeric:tabular-nums}',
        '.dsic-chip{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));color:var(--dsw-alias-label-secondary,inherit);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px}',
        '.dsic-chipOn{border-color:rgba(80,200,120,.4);color:#7ddb9c;background:rgba(80,200,120,.12)}',
        '.dsic-input{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-3,transparent));height:34px;font:inherit;color:var(--dsw-alias-label-primary,inherit);border-radius:8px;padding:0 12px;font-size:13px;box-sizing:border-box;width:100%}',
        '.dsic-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:8px;padding:6px 14px;font-size:13px;line-height:1.5;background:transparent;color:var(--dsw-alias-label-primary,inherit);transition:background-color .13s,border-color .13s}',
        '.dsic-btn:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed,rgba(128,128,128,.6))}',
        '.dsic-btn:disabled{opacity:.45;cursor:default}',
        '.dsic-btnPrimary{background:var(--dsw-alias-button-info-fill,#4d6bfe);border-color:var(--dsw-alias-button-info-fill,#4d6bfe);color:var(--dsw-alias-label-primary-foreground,#fff)}',
        '.dsic-btnPrimary:hover:not(:disabled){filter:brightness(1.08)}',
        '.dsic-btnDanger{border-color:rgba(224,85,85,.5);color:#e05555}',
        '.dsic-btnDanger:hover:not(:disabled){background:rgba(224,85,85,.12)}',
        '.dsic-actions{align-items:center;gap:8px;margin-top:12px;display:flex;flex-wrap:wrap}',
        '.dsic-check{align-items:center;gap:6px;color:var(--dsw-alias-label-primary,inherit);font-size:13px;display:inline-flex;cursor:pointer}',
        '.dsic-check input{accent-color:var(--dsw-alias-brand-primary,#4d6bfe)}',
        '.dsic-preview{align-items:center;gap:12px;display:flex}',
        '.dsic-previewBox{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:10px;background:var(--dsw-alias-bg-layer-2,transparent);width:56px;height:56px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;flex:none}',
        '.dsic-previewBox img{width:100%;height:100%;object-fit:contain;image-rendering:auto}',
        '.dsic-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}',
        '.dsic-libItem{align-items:center;gap:10px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:8px;padding:6px 10px;display:flex}',
        '.dsic-libName{flex:1;min-width:0;color:var(--dsw-alias-label-primary,inherit);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dsic-libMeta{color:var(--dsw-alias-label-tertiary,inherit);font-size:11px;font-variant-numeric:tabular-nums}',
        '.dsic-tabs{display:flex;gap:6px;margin:10px 0 4px;flex-wrap:wrap}',
        '.dsic-tab{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:transparent;color:var(--dsw-alias-label-secondary,inherit);border-radius:999px;padding:3px 12px;font:inherit;font-size:12px;cursor:pointer}',
        '.dsic-tabOn{background:var(--dsw-alias-interactive-bg-hover-accent,rgba(77,107,254,.16));color:var(--dsw-alias-brand-primary,#4d6bfe);border-color:transparent}',
      ].join('')

      var CSS_ID = 'dsh-icon-console/card.css'
      if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_ID) + ']') === null) {
        var tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-icon-console'
        tag.dataset.pluginCss = CSS_ID
        tag.textContent = CSS_TEXT
        document.head.appendChild(tag)
      }

      // ------------------------------------------------------------- copy
      var T = {
        'title': '图标控制台',
        'description': '自定义应用、托盘与快捷方式图标，一键重启。',
        'current': '当前图标',
        'targets': '应用范围',
        'shortcutDesktop': '桌面快捷方式',
        'shortcutStartMenu': '开始菜单快捷方式',
        'appWindow': '应用窗口图标',
        'appTray': '系统托盘图标',
        'stateCustom': '自定义',
        'stateOfficial': '官方',
        'stateMissing': '不存在',
        'needsRestart': '需重启生效',
        'immediate': '立即生效',
        'source': '图标来源',
        'sourceUpload': '本地上传',
        'sourcePath': '文件路径',
        'choose': '选择文件',
        'noFile': '未选择文件',
        'pathPlaceholder': 'C:\\path\\to\\icon.ico',
        'apply': '应用图标',
        'applying': '应用中…',
        'saveToLibrary': '存入图标库',
        'restore': '恢复官方图标',
        'restoring': '恢复中…',
        'library': '图标库',
        'libraryEmpty': '图标库为空。应用图标时可勾选「存入图标库」保存常用图标。',
        'use': '使用',
        'remove': '删除',
        'appControl': '应用控制',
        'restart': '重启应用',
        'exit': '退出应用',
        'restartHintFallback': '将结束当前进程，请手动重新启动。',
        'restartConfirm': '确定要重启应用吗？当前会话会中断。',
        'exitConfirm': '确定要退出应用吗？当前会话会中断。',
        'unsavedHint': '图标文件会存入 ~/.dsh/icon-console/library，官方图标已自动备份。',
        'pickIcoHint': '快捷方式图标需要 .ico；应用/托盘图标支持 .ico 和 .png。',
        'pickTitle': '选择图标文件',
        'pickFilename': '图标',
        'pickUploadTitle': '选择要上传的图标',
        'refresh': '刷新状态',
        'expand': '展开设置',
        'collapse': '收起设置',
        'loading': '正在读取状态…',
        'loadFailed': '状态读取失败',
        'loadFailedHint': '图标控制台无法读取宿主状态；插件可能未随宿主启动。',
        'applied': '已应用',
        'restored': '已恢复官方图标',
        'restorePartial': '部分恢复失败',
        'restartSent': '重启指令已发送',
        'exitSent': '退出指令已发送',
        'installRootMissing': '未找到 DSH 桌面端安装目录，应用/托盘图标不可用。',
        'pathTabHint': '直接填写磁盘上的 .ico / .png 路径。',
        'uploadTabHint': '从本机选择一个图标文件并上传。',
        'librarySaved': '已存入图标库',
        'usingLibrary': '已选用图标',
      }

      // ------------------------------------------------------------- wire
      function fetchJson(url, init) {
        return fetch(url, init).then(function (res) {
          return res.json().then(function (body) { return { status: res.status, body: body } })
        })
      }

      function apiStatus() {
        return fetchJson(BASE + '/status').then(function (r) {
          if (!r.body || r.body.ok !== true) throw new Error((r.body && r.body.error) || 'HTTP ' + r.status)
          return r.body
        })
      }

      function apiApply(payload) {
        return fetchJson(BASE + '/apply', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(function (r) {
          if (!r.body || r.body.ok !== true) {
            var detail = r.body && r.body.error ? r.body.error : 'HTTP ' + r.status
            var err = new Error(detail)
            err.report = r.body
            throw err
          }
          return r.body
        })
      }

      function apiRestore(scope) {
        return fetchJson(BASE + '/restore', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scope: scope || 'all' }),
        }).then(function (r) {
          if (!r.body || r.body.ok !== true) throw new Error((r.body && r.body.error) || 'HTTP ' + r.status)
          return r.body
        })
      }

      function apiLibrary() {
        return fetchJson(BASE + '/library').then(function (r) {
          if (!r.body || r.body.ok !== true) throw new Error((r.body && r.body.error) || 'HTTP ' + r.status)
          return r.body
        })
      }

      function apiLibraryAdd(payload) {
        return fetchJson(BASE + '/library/add', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(function (r) {
          if (!r.body || r.body.ok !== true) throw new Error((r.body && r.body.error) || 'HTTP ' + r.status)
          return r.body
        })
      }

      function apiLibraryRemove(file) {
        return fetchJson(BASE + '/library/remove', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ file: file }),
        }).then(function (r) {
          if (!r.body || r.body.ok !== true) throw new Error((r.body && r.body.error) || 'HTTP ' + r.status)
          return r.body
        })
      }

      function apiControl(action) {
        return fetchJson(BASE + '/' + action, { method: 'POST' }).then(function (r) {
          if (!r.body || r.body.ok !== true) throw new Error((r.body && r.body.error) || 'HTTP ' + r.status)
          return r.body
        })
      }

      // ------------------------------------------------------------ atoms
      function Row(props) {
        return React.createElement('div', { className: 'dsic-row' }, props.children)
      }

      function Check(props) {
        return React.createElement('label', { className: 'dsic-check' },
          React.createElement('input', {
            type: 'checkbox',
            checked: props.checked === true,
            disabled: props.disabled === true,
            onChange: function (event) { props.onChange(event.target.checked) },
          }),
          props.label
        )
      }

      function shortPath(value) {
        if (typeof value !== 'string' || value === '') return ''
        if (value.length <= 52) return value
        return '…' + value.slice(value.length - 51)
      }

      // ------------------------------------------------------- main card
      function IconConsoleCard() {
        var state = React.useState({
          open: false,
          status: null,
          error: null,
          loading: true,
          sourceTab: 'upload',
          upload: null,
          manualPath: '',
          shortcuts: { desktop: true, startMenu: true },
          application: { 'icon.png': false, 'tray.ico': false },
          saveToLibrary: false,
          library: [],
          busy: false,
          message: null,
          messageKind: 'ok',
        })
        var view = state[0]
        var setView = state[1]
        var t = function (key) { return T[key] || key }

        var refresh = React.useCallback(function () {
          apiStatus()
            .then(function (status) {
              setView(function (prev) {
                return Object.assign({}, prev, { status: status, error: null, loading: false })
              })
            })
            .catch(function (err) {
              setView(function (prev) {
                return Object.assign({}, prev, { error: String(err && err.message ? err.message : err), loading: false })
              })
            })
        }, [])

        var refreshLibrary = React.useCallback(function () {
          apiLibrary()
            .then(function (result) {
              setView(function (prev) { return Object.assign({}, prev, { library: result.entries || [] }) })
            })
            .catch(function () { /* the library is optional */ })
        }, [])

        React.useEffect(function () {
          refresh()
          refreshLibrary()
        }, [refresh, refreshLibrary])

        function set(patch) {
          setView(function (prev) { return Object.assign({}, prev, patch) })
        }

        function note(kind, message) {
          set({ message: message, messageKind: kind })
        }

        function onPickFile(event) {
          var file = event.target.files && event.target.files[0]
          if (!file) return
          var reader = new FileReader()
          reader.onload = function () {
            set({ upload: { name: file.name, data: String(reader.result), size: file.size } })
          }
          reader.onerror = function () { note('error', '读取文件失败') }
          reader.readAsDataURL(file)
        }

        function resolveSource() {
          if (view.sourceTab === 'path') {
            if (view.manualPath.trim() === '') { note('error', '请填写图标文件路径'); return null }
            return { source: view.manualPath.trim() }
          }
          if (!view.upload) { note('error', '请先选择图标文件'); return null }
          return { upload: { name: view.upload.name, data: view.upload.data } }
        }

        function runApply() {
          var source = resolveSource()
          if (!source) return
          var shortcuts = []
          if (view.shortcuts.desktop) {
            shortcuts.push('desktop')
            if (view.status === null || view.status.settings === undefined || view.status.settings.includeStartMenu !== false) {
              if (view.shortcuts.startMenu) shortcuts.push('startMenu')
            }
          } else if (view.shortcuts.startMenu) {
            shortcuts.push('startMenu')
          }
          var application = []
          if (view.application['icon.png']) application.push('icon.png')
          if (view.application['tray.ico']) application.push('tray.ico')
          if (shortcuts.length === 0 && application.length === 0) { note('error', '请至少选择一个应用范围'); return }

          set({ busy: true, message: null })
          apiApply(Object.assign({ shortcuts: shortcuts, application: application }, source))
            .then(function (report) {
              if (view.saveToLibrary) {
                return apiLibraryAdd(Object.assign({ name: baseName(source), }, source)).then(function () {
                  return report
                }, function () { return report })
              }
              return report
            })
            .then(function (report) {
              var needsRestart = report.needsRestart === true
              var failed = []
              Object.keys(report.shortcuts || {}).forEach(function (k) { if (report.shortcuts[k] && report.shortcuts[k].ok === false) failed.push(k) })
              Object.keys(report.application || {}).forEach(function (k) { if (report.application[k] && report.application[k].ok === false) failed.push(k) })
              if (failed.length > 0) {
                var first = (report.shortcuts && report.shortcuts[failed[0]]) || (report.application && report.application[failed[0]]) || {}
                note('warn', t('applied') + '（部分失败：' + failed.join('、') + '）' + (first.error ? ' — ' + first.error : ''))
              } else {
                note(needsRestart ? 'warn' : 'ok', t('applied') + (needsRestart ? '，' + t('needsRestart') : ''))
              }
              refreshLibrary()
              set({ busy: false })
              refresh()
            })
            .catch(function (err) {
              set({ busy: false })
              note('error', String(err && err.message ? err.message : err))
            })
        }

        function runRestore() {
          set({ busy: true, message: null })
          apiRestore('all')
            .then(function (report) {
              set({ busy: false })
              note(report.needsRestart ? 'warn' : 'ok', t('restored') + (report.needsRestart ? '，' + t('needsRestart') : ''))
              refresh()
            })
            .catch(function (err) {
              set({ busy: false })
              note('error', String(err && err.message ? err.message : err))
            })
        }

        function useLibraryEntry(entry) {
          set({ sourceTab: 'path', manualPath: entry.path, message: null })
          note('ok', t('usingLibrary') + ': ' + entry.name)
        }

        function removeLibraryEntry(entry) {
          apiLibraryRemove(entry.file)
            .then(function () { refreshLibrary() })
            .catch(function (err) { note('error', String(err && err.message ? err.message : err)) })
        }

        function runControl(action, confirmKey) {
          if (!window.confirm(t(confirmKey))) return
          set({ busy: true, message: null })
          apiControl(action)
            .then(function () {
              note('ok', t(action === 'restart' ? 'restartSent' : 'exitSent'))
            })
            .catch(function (err) {
              set({ busy: false })
              note('error', String(err && err.message ? err.message : err))
            })
        }

        function baseName(source) {
          if (source.upload) return source.upload.name || ('icon-' + Date.now())
          var p = String(source.source || '')
          var parts = p.split(/[\\/]/)
          return parts[parts.length - 1] || ('icon-' + Date.now())
        }

        // ------------------------------------------------------ rendering
        var status = view.status
        var header = React.createElement('button', {
          type: 'button',
          className: 'dsic-header',
          'aria-expanded': view.open,
          onClick: function () { set({ open: !view.open }) },
        },
          React.createElement('span', { className: 'dsic-headText' },
            React.createElement('span', { className: 'dsic-name' }, t('title')),
            React.createElement('span', { className: 'dsic-description' }, t('description'))
          ),
          React.createElement('svg', {
            width: '14', height: '14', viewBox: '0 0 14 14', fill: 'none',
            className: view.open ? 'dsic-chevron dsic-chevronOpen' : 'dsic-chevron',
          },
            React.createElement('path', {
              d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z',
              fill: 'currentColor',
            })
          )
        )

        if (!view.open) {
          return React.createElement('div', { className: 'dsic-card' }, header)
        }

        var body = []

        if (view.loading) {
          body.push(React.createElement('p', { key: 'loading', className: 'dsic-hint' }, t('loading')))
        } else if (view.error !== null) {
          body.push(React.createElement('p', { key: 'err', className: 'dsic-error' }, t('loadFailed') + ': ' + view.error))
          body.push(React.createElement('p', { key: 'errhint', className: 'dsic-hint' }, t('loadFailedHint')))
          body.push(React.createElement('div', { key: 'errbtn', className: 'dsic-actions' },
            React.createElement('button', { type: 'button', className: 'dsic-btn', onClick: refresh }, t('refresh'))
          ))
        } else if (status !== null) {
          // ---- current state ----
          body.push(React.createElement('div', { key: 'cur', className: 'dsic-section' }, t('current')))
          var shortcutRows = [
            ['desktop', t('shortcutDesktop')],
            ['startMenu', t('shortcutStartMenu')],
          ]
          shortcutRows.forEach(function (pair) {
            var info = status.shortcuts[pair[0]] || {}
            var chips = []
            chips.push(React.createElement('span', {
              key: 'state',
              className: info.custom ? 'dsic-chip dsic-chipOn' : 'dsic-chip',
            }, info.custom ? t('stateCustom') : (info.exists ? t('stateOfficial') : t('stateMissing'))))
            chips.push(React.createElement('span', { key: 'imm', className: 'dsic-chip' }, t('immediate')))
            body.push(React.createElement(Row, { key: 'sc-' + pair[0] },
              React.createElement('span', { className: 'dsic-rowLabel' }, pair[1]),
              chips
            ))
          })
          var appRows = [
            ['icon.png', t('appWindow')],
            ['tray.ico', t('appTray')],
          ]
          appRows.forEach(function (pair) {
            var info = status.application[pair[0]] || {}
            var chips = []
            chips.push(React.createElement('span', {
              key: 'state',
              className: info.custom ? 'dsic-chip dsic-chipOn' : 'dsic-chip',
            }, info.custom ? t('stateCustom') : t('stateOfficial')))
            chips.push(React.createElement('span', { key: 'rst', className: 'dsic-chip' }, t('needsRestart')))
            body.push(React.createElement(Row, { key: 'app-' + pair[0] },
              React.createElement('span', { className: 'dsic-rowLabel' }, pair[1]),
              chips
            ))
          })
          if (status.installRoot === undefined || status.installRoot === null) {
            body.push(React.createElement('p', { key: 'noroot', className: 'dsic-warn' }, t('installRootMissing')))
          }

          // ---- source ----
          body.push(React.createElement('div', { key: 'src', className: 'dsic-section' }, t('source')))
          body.push(React.createElement('div', { key: 'tabs', className: 'dsic-tabs' },
            React.createElement('button', {
              type: 'button',
              className: view.sourceTab === 'upload' ? 'dsic-tab dsic-tabOn' : 'dsic-tab',
              onClick: function () { set({ sourceTab: 'upload' }) },
            }, t('sourceUpload')),
            React.createElement('button', {
              type: 'button',
              className: view.sourceTab === 'path' ? 'dsic-tab dsic-tabOn' : 'dsic-tab',
              onClick: function () { set({ sourceTab: 'path' }) },
            }, t('sourcePath'))
          ))

          if (view.sourceTab === 'upload') {
            body.push(React.createElement('p', { key: 'uphint', className: 'dsic-hint' }, t('uploadTabHint')))
            body.push(React.createElement('div', { key: 'uppick', className: 'dsic-row' },
              React.createElement('input', {
                type: 'file',
                accept: '.ico,.png,image/x-icon,image/png',
                title: t('pickUploadTitle'),
                onChange: onPickFile,
              }),
              React.createElement('span', { className: 'dsic-rowState' },
                view.upload ? (view.upload.name + ' · ' + Math.round((view.upload.size || 0) / 1024) + ' KB') : t('noFile'))
            ))
          } else {
            body.push(React.createElement('p', { key: 'pathhint', className: 'dsic-hint' }, t('pathTabHint')))
            body.push(React.createElement('div', { key: 'pathrow', className: 'dsic-row' },
              React.createElement('input', {
                type: 'text',
                className: 'dsic-input',
                placeholder: t('pathPlaceholder'),
                value: view.manualPath,
                onChange: function (event) { set({ manualPath: event.target.value }) },
              })
            ))
          }
          body.push(React.createElement('p', { key: 'pickhint', className: 'dsic-hint' }, t('pickIcoHint')))

          // ---- scope ----
          body.push(React.createElement('div', { key: 'scope', className: 'dsic-section' }, t('targets')))
          body.push(React.createElement('div', { key: 'checks', className: 'dsic-row' },
            Check({
              label: t('shortcutDesktop'),
              checked: view.shortcuts.desktop,
              onChange: function (v) { set({ shortcuts: Object.assign({}, view.shortcuts, { desktop: v }) }) },
            }),
            Check({
              label: t('shortcutStartMenu'),
              checked: view.shortcuts.startMenu,
              onChange: function (v) { set({ shortcuts: Object.assign({}, view.shortcuts, { startMenu: v }) }) },
            }),
            Check({
              label: t('appWindow'),
              checked: view.application['icon.png'],
              disabled: status.installRoot === undefined || status.installRoot === null,
              onChange: function (v) { set({ application: Object.assign({}, view.application, { 'icon.png': v }) }) },
            }),
            Check({
              label: t('appTray'),
              checked: view.application['tray.ico'],
              disabled: status.installRoot === undefined || status.installRoot === null,
              onChange: function (v) { set({ application: Object.assign({}, view.application, { 'tray.ico': v }) }) },
            })
          ))
          body.push(React.createElement('div', { key: 'savelib', className: 'dsic-row' },
            Check({
              label: t('saveToLibrary'),
              checked: view.saveToLibrary,
              onChange: function (v) { set({ saveToLibrary: v }) },
            })
          ))
          body.push(React.createElement('p', { key: 'safelib', className: 'dsic-hint' }, t('unsavedHint')))

          // ---- actions ----
          body.push(React.createElement('div', { key: 'act', className: 'dsic-actions' },
            React.createElement('button', {
              type: 'button',
              className: 'dsic-btn dsic-btnPrimary',
              disabled: view.busy,
              onClick: runApply,
            }, view.busy ? t('applying') : t('apply')),
            React.createElement('button', {
              type: 'button',
              className: 'dsic-btn',
              disabled: view.busy,
              onClick: runRestore,
            }, t('restore')),
            React.createElement('button', {
              type: 'button',
              className: 'dsic-btn',
              disabled: view.busy,
              onClick: function () { refresh(); refreshLibrary() },
            }, t('refresh'))
          ))

          if (view.message !== null) {
            var cls = view.messageKind === 'error' ? 'dsic-error' : (view.messageKind === 'warn' ? 'dsic-warn' : 'dsic-ok')
            body.push(React.createElement('p', { key: 'msg', className: cls, role: 'status' }, view.message))
          }

          // ---- library ----
          body.push(React.createElement('div', { key: 'libsec', className: 'dsic-section' }, t('library')))
          if (view.library.length === 0) {
            body.push(React.createElement('p', { key: 'libempty', className: 'dsic-hint' }, t('libraryEmpty')))
          } else {
            body.push(React.createElement('ul', { key: 'liblist', className: 'dsic-list' },
              view.library.slice(0, 30).map(function (entry) {
                return React.createElement('li', { key: entry.file, className: 'dsic-libItem' },
                  React.createElement('span', { className: 'dsic-libName', title: entry.path }, entry.name),
                  React.createElement('span', { className: 'dsic-libMeta' }, Math.round((entry.bytes || 0) / 1024) + ' KB'),
                  React.createElement('button', {
                    type: 'button', className: 'dsic-btn',
                    onClick: function () { useLibraryEntry(entry) },
                  }, t('use')),
                  React.createElement('button', {
                    type: 'button', className: 'dsic-btn dsic-btnDanger',
                    onClick: function () { removeLibraryEntry(entry) },
                  }, t('remove'))
                )
              })
            ))
          }

          // ---- application control ----
          body.push(React.createElement('div', { key: 'ctlsec', className: 'dsic-section' }, t('appControl')))
          body.push(React.createElement('div', { key: 'ctl', className: 'dsic-actions' },
            React.createElement('button', {
              type: 'button', className: 'dsic-btn', disabled: view.busy,
              onClick: function () { runControl('restart', 'restartConfirm') },
            }, t('restart')),
            React.createElement('button', {
              type: 'button', className: 'dsic-btn dsic-btnDanger', disabled: view.busy,
              onClick: function () { runControl('exit', 'exitConfirm') },
            }, t('exit'))
          ))
          body.push(React.createElement('p', { key: 'ctlhint', className: 'dsic-hint' },
            status.restartHint || t('restartHintFallback')))
        }

        return React.createElement('div', { className: view.open ? 'dsic-card dsic-cardOpen' : 'dsic-card' },
          header,
          React.createElement('div', { className: 'dsic-body' }, body)
        )
      }

      // ----------------------------------------------------------- plugin
      var inject = ['slots']

      function apply(ctx) {
        ctx.effect(function () {
          return ctx.slots.inject('settings.section', function () {
            return ctx.slots.register({
              name: 'settings.section',
              id: 'icon-console',
              order: 90,
              label: function () { return '图标控制台' },
            }, IconConsoleCard)
          })
        }, 'dsh-icon-console: settings card')
      }

      exports.apply = apply
      exports.inject = inject
      return module.exports
    },
  })
}
