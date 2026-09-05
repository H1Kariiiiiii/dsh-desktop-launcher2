// dsh-desktop-launcher2 client bundle (rc.1) — UI ported from
// @linxin666/dsh-desktop-launcher 0.2.8 (Apache-2.0):
//   1. Plugin settings card (settings.section slot): collapsible card with
//      the launcher fields (enabled / announce / dshCommand / url / profile /
//      iconPath / confirmShutdown), staged form + save/discard, and the
//      "create desktop icon" action.
//   2. Floating power button (shell.overlay slot): bottom-right shutdown
//      trigger with a confirm dialog, backed by the loopback-only
//      /api/dsh-desktop-launcher2/shutdown route.
//
// Bundle format: lazy-CJS factory registered through window.__ModuleLoader__
// (combo scripts are classic <script> tags, so a plain ESM `export` would
// SyntaxError in the browser). Only `react` is required (a platform seed
// word); no @deepseek-ai client packages are required. The window guard keeps
// a bare Node import (self-check) side-effect free.
// @module dsh-desktop-launcher2/client

if (typeof window !== 'undefined' && typeof window.__ModuleLoader__ !== 'undefined') {
  window.__ModuleLoader__.load({
    id: 'dsh-desktop-launcher2',
    factory: (require) => {
      var module = { exports: {} }
      var exports = module.exports

      var React = require('react')
      // react-dom / react-dom/client are platform seed words (the web-all
      // bundle already requires them), used for the floating button mount.
      var ReactDom = require('react-dom')
      var ReactDomClient = require('react-dom/client')

      var BASE = '/api/dsh-desktop-launcher2'

      // ---------------------------------------------------------------- CSS
      // Port of the original css modules (settings-card / launcher-card /
      // shutdown) to a plain stylesheet tag, using the same design tokens.
      var CSS_TEXT = [
        '.dshdl2-card{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-3,transparent);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}',
        '.dshdl2-card:hover{border-color:var(--dsw-alias-label-dimmed,rgba(128,128,128,.6))}',
        '.dshdl2-cardOpen{background:var(--dsw-alias-bg-layer-2,transparent);border-color:var(--dsw-alias-label-dimmed,rgba(128,128,128,.6))}',
        '.dshdl2-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}',
        '.dshdl2-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:-2px}',
        '.dshdl2-headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}',
        '.dshdl2-name{color:var(--dsw-alias-label-primary,inherit);font-size:15px;font-weight:600;line-height:1.4}',
        '.dshdl2-description{color:var(--dsw-alias-label-tertiary,inherit);font-size:13px;line-height:1.5}',
        '.dshdl2-pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform,transparent);color:var(--dsw-alias-label-secondary,inherit);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}',
        '.dshdl2-chevron{color:var(--dsw-alias-label-tertiary,inherit);flex:none;transition:transform .16s}',
        '.dshdl2-chevronOpen{transform:rotate(180deg)}',
        '.dshdl2-body{border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));margin:0 16px;padding-bottom:8px}',
        '.dshdl2-readOnly{color:var(--dsw-alias-label-tertiary,inherit);margin:12px 0 0;font-size:12px;line-height:1.5}',
        '.dshdl2-footer{border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}',
        '.dshdl2-failed{min-width:0;color:var(--dsw-alias-label-error,inherit);flex:1;margin:0;font-size:12px;line-height:1.5;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}',
        '.dshdl2-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}',
        '.dshdl2-discard{border-color:var(--dsw-alias-border-l2,rgba(128,128,128,.35));color:var(--dsw-alias-label-secondary,inherit);background:transparent}',
        '.dshdl2-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary,inherit);border-color:var(--dsw-alias-label-dimmed,rgba(128,128,128,.6))}',
        '.dshdl2-save{background:var(--dsw-alias-label-primary,inherit);color:var(--dsw-alias-bg-layer-3,inherit)}',
        '.dshdl2-btn:disabled{opacity:.4;cursor:default}',
        '.dshdl2-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}',
        '.dshdl2-field{flex-direction:column;gap:6px;padding:12px 0;display:flex}',
        '.dshdl2-field+.dshdl2-field{border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35))}',
        '.dshdl2-head{align-items:center;gap:8px;display:flex}',
        '.dshdl2-label{min-width:0;color:var(--dsw-alias-label-primary,inherit);flex:1;font-size:13px;font-weight:500;line-height:1.5}',
        '.dshdl2-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform,transparent);color:var(--dsw-alias-label-secondary,inherit);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}',
        '.dshdl2-reset{font:inherit;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;background:transparent;border:none;padding:0;font-size:12px;line-height:1.5}',
        '.dshdl2-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary,inherit)}',
        '.dshdl2-input{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-3,transparent);height:34px;font:inherit;color:var(--dsw-alias-label-primary,inherit);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5;box-sizing:border-box;width:100%}',
        '.dshdl2-input:focus-visible{border-color:var(--dsw-alias-brand-primary,#4d6bfe);outline:none}',
        '.dshdl2-inputInvalid{border:1px solid var(--dsw-alias-label-error,inherit);background:var(--dsw-alias-bg-layer-3,transparent);height:34px;font:inherit;color:var(--dsw-alias-label-primary,inherit);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5;box-sizing:border-box;width:100%}',
        '.dshdl2-hint{color:var(--dsw-alias-label-tertiary,inherit);margin:0;font-size:12px;line-height:1.5}',
        '.dshdl2-invalid{color:var(--dsw-alias-label-error,inherit);margin:0;font-size:12px;line-height:1.5}',
        '.dshdl2-selectWrap{position:relative}',
        '.dshdl2-select{appearance:none;width:100%;text-align:left;cursor:pointer;align-items:center;justify-content:space-between;gap:8px;display:flex;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-3,transparent);height:34px;font:inherit;color:var(--dsw-alias-label-primary,inherit);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5;box-sizing:border-box}',
        '.dshdl2-select:disabled{color:var(--dsw-alias-label-tertiary,inherit);cursor:default}',
        '.dshdl2-selectPopup{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:40;flex-direction:column;max-height:240px;overflow-y:auto;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:8px;background:var(--dsw-alias-bg-layer-3,inherit);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2,transparent);padding:4px;display:flex}',
        '.dshdl2-selectOption{flex-shrink:0;border-radius:6px;padding:6px 10px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,inherit);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.dshdl2-selectOption:hover,.dshdl2-selectOptionActive{background:var(--dsw-alias-interactive-bg-hover,transparent)}',
        '.dshdl2-selectOptionSelected{color:var(--dsw-alias-brand-primary,#4d6bfe);font-weight:500;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 10%,transparent)}',
        '.dshdl2-actions{flex-direction:column;align-items:flex-start;gap:8px;padding:12px 0;display:flex}',
        '.dshdl2-create{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:6px 16px;background:var(--dsw-alias-label-primary,inherit);color:var(--dsw-alias-bg-layer-3,inherit);font-size:13px;line-height:1.5}',
        '.dshdl2-create:disabled{opacity:.4;cursor:default}',
        '.dshdl2-create:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}',
        '.dshdl2-ok{color:var(--dsw-alias-label-secondary,inherit);margin:0;font-size:12px;line-height:1.5;word-break:break-all}',
        '.dshdl2-error{color:var(--dsw-alias-label-error,inherit);margin:0;font-size:12px;line-height:1.5;word-break:break-all}',
        '.dshdl2-off{color:var(--dsw-alias-label-secondary,inherit);margin:0;font-size:12px;line-height:1.5;word-break:break-all}',
        '.dshdl2-separator{border:none;border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));margin:16px 0 12px}',
        '.dshdl2-sectionTitle{margin:0 0 8px;font-size:14px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary,inherit)}',
        // Floating power trigger + confirm dialog.
        '.dshdl2-triggerFloating{position:fixed;right:24px;bottom:24px;z-index:900;display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border:none;border-radius:50%;padding:0;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-secondary,inherit);box-shadow:var(--dsw-shadow-lv3,0 4px 16px rgba(0,0,0,.2));cursor:pointer;transition:background-color 120ms ease,color 120ms ease,box-shadow 120ms ease}',
        '.dshdl2-triggerFloating:hover{background:var(--dsw-alias-interactive-bg-hover,transparent);color:var(--dsw-alias-label-primary,inherit)}',
        '.dshdl2-triggerFloating:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2,transparent),0 0 0 4px var(--dsw-alias-brand-primary,#4d6bfe)}',
        '.dshdl2-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center}',
        '.dshdl2-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.5));backdrop-filter:var(--dsw-mask-blur,none)}',
        '.dshdl2-dialog{position:relative;z-index:1;box-sizing:border-box;width:400px;max-width:calc(100vw - 48px);border-radius:20px;background:var(--dsw-alias-bg-layer-2,transparent);box-shadow:var(--dsw-shadow-lv3,0 8px 32px rgba(0,0,0,.3));color:var(--dsw-alias-label-primary,inherit);font-size:14px;line-height:22px}',
        '.dshdl2-dialogBody{display:flex;flex-direction:column;align-items:center;gap:12px;padding:28px 24px 24px;text-align:center}',
        '.dshdl2-dialogIcon{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:var(--dsw-alias-interactive-bg-hover,transparent);color:var(--dsw-alias-label-primary,inherit)}',
        '.dshdl2-dialogTitle{margin:0;font-size:18px;font-weight:600;line-height:26px}',
        '.dshdl2-dialogText,.dshdl2-dialogStatus,.dshdl2-dialogError{margin:0;color:var(--dsw-alias-label-secondary,inherit);font-size:13px}',
        '.dshdl2-dialogError{color:var(--dsw-alias-state-error-primary,inherit)}',
        '.dshdl2-dialogActions{display:flex;justify-content:center;gap:10px;margin-top:8px}',
        '.dshdl2-cancel,.dshdl2-confirm{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 18px;border-radius:10px;font-size:13px;cursor:pointer;white-space:nowrap;transition:background-color 120ms ease,border-color 120ms ease,box-shadow 120ms ease}',
        '.dshdl2-cancel{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:transparent;color:var(--dsw-alias-label-secondary,inherit)}',
        '.dshdl2-cancel:hover{border-color:var(--dsw-alias-label-dimmed,rgba(128,128,128,.6));color:var(--dsw-alias-label-primary,inherit)}',
        '.dshdl2-confirm{border:1px solid transparent;background:var(--dsw-alias-label-primary,inherit);color:var(--dsw-alias-bg-layer-2,inherit)}',
        '.dshdl2-confirm:hover{filter:brightness(1.08)}',
        '.dshdl2-cancel:focus-visible,.dshdl2-confirm:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2,transparent),0 0 0 4px var(--dsw-alias-brand-primary,#4d6bfe)}',
        '.dshdl2-cancel:disabled,.dshdl2-confirm:disabled{opacity:.5;cursor:default}',
      ].join('')

      var CSS_ID = 'dsh-desktop-launcher2/card.css'
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_ID) + ']') === null) {
        var tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-desktop-launcher2'
        tag.dataset.pluginCss = CSS_ID
        tag.textContent = CSS_TEXT
        document.head.appendChild(tag)
      }

      // ------------------------------------------------------------- copy
      var T = {
        'settings.title': '桌面启动器',
        'settings.description': '桌面图标创建与一键关机。',
        'settings.enabled': '启用插件',
        'settings.enabledHint': '关闭后不再提供桌面图标创建与关机按钮。',
        'settings.announceToAgent': '向 Agent 公告',
        'settings.announceToAgentHint': '关闭后系统提示词不再介绍本插件。',
        'settings.dshCommand': 'dsh 命令',
        'settings.dshCommandHint': '启动器调用的命令，需在 PATH 中（默认 dsh）。',
        'settings.url': 'Web GUI 地址',
        'settings.urlHint': '启动后等待就绪并打开的地址（默认 http://127.0.0.1:3080）。',
        'settings.profile': '启动 profile（可选）',
        'settings.profileHint': '留空表示不带 --profile 参数启动 dsh web。',
        'settings.iconPath': '图标文件（可选）',
        'settings.iconPathHint': '桌面图标的 .ico/.png 路径；留空使用内置的 dsh 图标。',
        'settings.create': '创建桌面图标',
        'settings.creating': '创建中…',
        'settings.created': '桌面图标已创建',
        'settings.createFailed': '创建桌面图标失败',
        'settings.requireEnabled': '开启「启用插件」并保存后，此按钮可用。',
        'settings.warning': '注意',
        'settings.shutdownSection': '一键关机',
        'settings.confirmShutdown': '退出前确认',
        'settings.confirmShutdownHint': '关闭后点击按钮直接退出，不再弹出确认框。',
        'entry.label': '退出 DeepSeek Harness',
        'dialog.title': '确认退出',
        'dialog.description': '关闭 DeepSeek Harness 会结束 dsh web 进程，正在运行的会话、任务与未保存状态可能中断。确定要退出吗？',
        'dialog.confirm': '退出',
        'dialog.cancel': '取消',
        'dialog.shuttingDown': '正在退出…',
        'dialog.failed': '退出请求失败：{message}',
        'dialog.retry': '重试',
        'dialog.close': '关闭',
        'settings.overridden': '已覆盖',
        'settings.reset': '恢复默认',
        'settings.inherit': '继承',
        'settings.on': '开',
        'settings.off': '关',
        'settings.expand': '展开设置',
        'settings.collapse': '收起设置',
        'settings.save': '保存',
        'settings.saving': '保存中…',
        'settings.discard': '放弃',
        'settings.unsaved': '未保存',
        'settings.saveFailed': '保存失败，请检查后重试。',
      }

      // ----------------------------------------------------- wire helpers
      function fetchJson(url, init) {
        return fetch(url, init).then(function (res) { return res.json() })
      }

      function apiStatus() {
        return fetchJson(BASE + '/status')
      }

      function apiCreate() {
        return fetchJson(BASE + '/install', { method: 'POST' }).then(function (body) {
          if (!body || body.error) throw new Error((body && body.error) || '创建失败')
          return body.result || body
        })
      }

      function apiSettingsGet() {
        return fetchJson(BASE + '/settings').then(function (body) { return (body && body.settings) || {} })
      }

      function apiSettingsSet(patch) {
        return fetchJson(BASE + '/settings', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        }).then(function (body) {
          if (!body || body.ok !== true) throw new Error((body && body.error) || '保存失败')
          return (body && body.settings) || {}
        })
      }

      function apiShutdown() {
        return fetch(BASE + '/shutdown', { method: 'POST' }).then(function (res) {
          if (!res.ok) throw new Error('shutdown request failed (HTTP ' + String(res.status) + ')')
        })
      }

      function closeCurrentPage() {
        window.close()
        if (!window.closed) window.location.replace('about:blank')
      }

      // ---------------------------------------------------------- widgets
      function PowerIcon(size) {
        return React.createElement('svg', {
          width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true,
        },
          React.createElement('path', { d: 'M6.9 6.4A8.6 8.6 0 1 0 17.1 6.4', stroke: 'currentColor', strokeWidth: '2.2', strokeLinecap: 'round' }),
          React.createElement('path', { d: 'M12 3.5v7.5', stroke: 'currentColor', strokeWidth: '2.2', strokeLinecap: 'round' })
        )
      }

      function ShutdownEntry(props) {
        var view = React.useState('closed')
        var current = view[0]
        var setView = view[1]
        var errorState = React.useState(undefined)
        var error = errorState[0]
        var setError = errorState[1]
        var t = props.t

        var close = function () {
          setView(function (v) { return v === 'shutting-down' ? v : 'closed' })
        }

        var performShutdown = function () {
          setError(undefined)
          setView('shutting-down')
          apiShutdown()
            .then(function () { closeCurrentPage() })
            .catch(function (caught) {
              setError(caught instanceof Error ? caught.message : String(caught))
              setView('error')
            })
        }

        var handleTrigger = function () {
          // Read the live confirmShutdown setting before acting (default
          // true when the settings read fails).
          try {
            fetch(BASE + '/settings').then(function (res) { return res.json() })
              .then(function (body) {
                var s = body && body.settings
                var confirm = !s || s.confirmShutdown !== false
                if (confirm) setView('confirm')
                else performShutdown()
              })
              .catch(function () { setView('confirm') })
          } catch (e) {
            setView('confirm')
          }
        }

        React.useEffect(function () {
          if (current === 'closed') return
          var onKeyDown = function (event) { if (event.key === 'Escape') close() }
          window.addEventListener('keydown', onKeyDown)
          return function () { window.removeEventListener('keydown', onKeyDown) }
        }, [current])

        var dialog = null
        if (current !== 'closed') {
          var body = null
          if (current === 'confirm') {
            body = React.createElement('div', { className: 'dshdl2-dialogBody' },
              React.createElement('div', { className: 'dshdl2-dialogIcon' }, PowerIcon(22)),
              React.createElement('h2', { className: 'dshdl2-dialogTitle' }, t('dialog.title')),
              React.createElement('p', { className: 'dshdl2-dialogText' }, t('dialog.description')),
              React.createElement('div', { className: 'dshdl2-dialogActions' },
                React.createElement('button', { type: 'button', className: 'dshdl2-cancel', onClick: close }, t('dialog.cancel')),
                React.createElement('button', { type: 'button', className: 'dshdl2-confirm', autoFocus: true, onClick: performShutdown }, t('dialog.confirm'))
              )
            )
          } else if (current === 'shutting-down') {
            body = React.createElement('div', { className: 'dshdl2-dialogBody' },
              React.createElement('div', { className: 'dshdl2-dialogIcon' }, PowerIcon(22)),
              React.createElement('p', { className: 'dshdl2-dialogStatus', role: 'status' }, t('dialog.shuttingDown'))
            )
          } else if (current === 'error') {
            body = React.createElement('div', { className: 'dshdl2-dialogBody' },
              React.createElement('div', { className: 'dshdl2-dialogIcon' }, PowerIcon(22)),
              React.createElement('p', { className: 'dshdl2-dialogError', role: 'alert' }, t('dialog.failed', { message: error || '' })),
              React.createElement('div', { className: 'dshdl2-dialogActions' },
                React.createElement('button', { type: 'button', className: 'dshdl2-cancel', onClick: close }, t('dialog.close')),
                React.createElement('button', { type: 'button', className: 'dshdl2-confirm', onClick: performShutdown }, t('dialog.retry'))
              )
            )
          }
          dialog = React.createElement('div', { className: 'dshdl2-overlay', role: 'presentation' },
            React.createElement('div', { className: 'dshdl2-mask', 'aria-hidden': true, onClick: close }),
            React.createElement('div', { className: 'dshdl2-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': t('dialog.title') }, body)
          )
        }

        return React.createElement(React.Fragment, null,
          React.createElement('button', {
            type: 'button',
            className: 'dshdl2-triggerFloating',
            'aria-label': t('entry.label'),
            title: t('entry.label'),
            onClick: handleTrigger,
          }, PowerIcon(20)),
          dialog
        )
      }

      function BooleanCell(props) {
        // 继承 / 开 / 关 staged select.
        var options = [
          { value: '', label: props.inheritLabel },
          { value: 'true', label: props.onLabel },
          { value: 'false', label: props.offLabel },
        ]
        var value = props.text
        return React.createElement('div', { className: 'dshdl2-field' },
          React.createElement('div', { className: 'dshdl2-head' },
            React.createElement('label', { className: 'dshdl2-label', htmlFor: props.id }, props.label),
            props.overridden
              ? React.createElement('span', { className: 'dshdl2-badge' }, props.overriddenLabel)
              : null
          ),
          React.createElement('select', {
            id: props.id,
            className: 'dshdl2-select',
            value: value,
            disabled: props.disabled,
            onChange: function (event) { props.onEdit(event.target.value) },
          }, options.map(function (option) {
            return React.createElement('option', { key: option.value, value: option.value }, option.label)
          })),
          React.createElement('p', { className: 'dshdl2-hint' }, props.hint)
        )
      }

      function ValueCell(props) {
        return React.createElement('div', { className: 'dshdl2-field' },
          React.createElement('div', { className: 'dshdl2-head' },
            React.createElement('label', { className: 'dshdl2-label', htmlFor: props.id }, props.label),
            props.overridden
              ? React.createElement('span', { className: 'dshdl2-badge' }, props.overriddenLabel)
              : null
          ),
          React.createElement('input', {
            id: props.id,
            className: props.invalid ? 'dshdl2-inputInvalid' : 'dshdl2-input',
            type: 'text',
            value: props.text,
            placeholder: props.placeholder || '',
            disabled: props.disabled,
            onChange: function (event) { props.onEdit(event.target.value) },
          }),
          React.createElement('p', { className: props.invalid ? 'dshdl2-invalid' : 'dshdl2-hint' },
            props.invalid ? props.invalidLabel : props.hint)
        )
      }

      function CollapsibleCard(props) {
        var open = React.useState(props.defaultOpen !== false)
        var isOpen = open[0]
        var setOpen = open[1]
        var className = isOpen ? 'dshdl2-cardOpen dshdl2-card' : 'dshdl2-card'
        return React.createElement('div', { className: className },
          React.createElement('button', {
            type: 'button',
            className: 'dshdl2-header',
            'aria-expanded': isOpen,
            'aria-label': props.t(isOpen ? 'settings.collapse' : 'settings.expand') + ': ' + props.title,
            onClick: function () { setOpen(!isOpen) },
          },
            React.createElement('span', { className: 'dshdl2-headText' },
              React.createElement('span', { className: 'dshdl2-name', title: props.title }, props.title),
              React.createElement('span', { className: 'dshdl2-description', title: props.description }, props.description)
            ),
            props.dirty
              ? React.createElement('span', { className: 'dshdl2-pending' }, props.t('settings.unsaved'))
              : null,
            React.createElement('svg', {
              width: '14', height: '14', viewBox: '0 0 14 14', fill: 'none',
              xmlns: 'http://www.w3.org/2000/svg',
              className: isOpen ? 'dshdl2-chevron dshdl2-chevronOpen' : 'dshdl2-chevron',
            },
              React.createElement('path', {
                d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z',
                fill: 'currentColor',
              })
            )
          ),
          isOpen
            ? React.createElement('div', { className: 'dshdl2-body' }, props.children)
            : null
        )
      }

      function SettingsCard() {
        var state = React.useState({ data: null, settings: null, editing: null, dirty: false, busy: false, message: null, error: null, creating: false, created: null, dead: false })
        var view = state[0]
        var setView = state[1]

        var refresh = React.useCallback(function () {
          Promise.all([apiStatus(), apiSettingsGet()])
            .then(function (results) {
              setView({ data: results[0], settings: results[1], editing: results[1], dirty: false, busy: false, message: null, error: null, creating: false, created: null, dead: false })
            })
            .catch(function (err) {
              setView({ data: null, settings: null, editing: null, dirty: false, busy: false, message: null, error: String(err), creating: false, created: null, dead: true })
            })
        }, [])

        React.useEffect(function () { refresh() }, [refresh])

        function edit(field, text) {
          setView(function (prev) {
            var editing = Object.assign({}, prev.editing)
            editing[field] = text
            return Object.assign({}, prev, { editing: editing, dirty: true, message: null })
          })
        }

        function resetField(field) {
          setView(function (prev) {
            var editing = Object.assign({}, prev.editing)
            editing[field] = undefined
            return Object.assign({}, prev, { editing: editing, dirty: true, message: null })
          })
        }

        function save() {
          setView(function (prev) { return Object.assign({}, prev, { busy: true, message: null }) })
          var patch = Object.assign({}, view.editing)
          // drop undefined / empty-string clears
          var clean = {}
          Object.keys(patch).forEach(function (key) {
            if (patch[key] !== undefined && patch[key] !== '') clean[key] = patch[key]
          })
          apiSettingsSet(clean)
            .then(function (settings) {
              setView(function (prev) {
                return Object.assign({}, prev, { settings: settings, editing: settings, dirty: false, busy: false, message: 'settings.saveOk', error: null })
              })
            })
            .catch(function (err) {
              setView(function (prev) {
                return Object.assign({}, prev, { busy: false, error: 'settings.saveFailed: ' + String(err) })
              })
            })
        }

        function discard() {
          setView(function (prev) {
            return Object.assign({}, prev, { editing: prev.settings, dirty: false, message: null, error: null })
          })
        }

        function create() {
          setView(function (prev) { return Object.assign({}, prev, { creating: true, message: null, error: null }) })
          apiCreate()
            .then(function (result) {
              setView(function (prev) {
                return Object.assign({}, prev, { creating: false, created: result, error: null })
              })
            })
            .catch(function (err) {
              setView(function (prev) {
                return Object.assign({}, prev, { creating: false, error: String(err) })
              })
            })
        }

        var t = function (key) { return T[key] || key }
        var settings = view.editing || {}
        var enabled = settings.enabled
        var createReady = String(enabled) === 'true'
        var disabled = view.dead

        var fields = null
        if (!view.dead) {
          fields = React.createElement(React.Fragment, null,
            BooleanCell({
              id: 'dshdl2-enabled', label: t('settings.enabled'), hint: t('settings.enabledHint'),
              inheritLabel: t('settings.inherit'), onLabel: t('settings.on'), offLabel: t('settings.off'),
              text: String(settings.enabled === undefined ? '' : settings.enabled),
              overridden: settings.enabled !== undefined, disabled: disabled, invalid: false,
              overriddenLabel: t('settings.overridden'), invalidLabel: '',
              onEdit: function (text) { edit('enabled', text === '' ? undefined : text === 'true') },
              onReset: function () { resetField('enabled') },
            }),
            BooleanCell({
              id: 'dshdl2-announce', label: t('settings.announceToAgent'), hint: t('settings.announceToAgentHint'),
              inheritLabel: t('settings.inherit'), onLabel: t('settings.on'), offLabel: t('settings.off'),
              text: String(settings.announceToAgent === undefined ? '' : settings.announceToAgent),
              overridden: settings.announceToAgent !== undefined, disabled: disabled, invalid: false,
              overriddenLabel: t('settings.overridden'), invalidLabel: '',
              onEdit: function (text) { edit('announceToAgent', text === '' ? undefined : text === 'true') },
              onReset: function () { resetField('announceToAgent') },
            }),
            ValueCell({
              id: 'dshdl2-command', label: t('settings.dshCommand'), hint: t('settings.dshCommandHint'),
              placeholder: 'dsh', text: String(settings.dshCommand === undefined ? '' : settings.dshCommand),
              overridden: settings.dshCommand !== undefined, disabled: disabled, invalid: false,
              overriddenLabel: t('settings.overridden'), invalidLabel: '',
              onEdit: function (text) { edit('dshCommand', text) },
              onReset: function () { resetField('dshCommand') },
            }),
            ValueCell({
              id: 'dshdl2-url', label: t('settings.url'), hint: t('settings.urlHint'),
              placeholder: 'http://127.0.0.1:3080', text: String(settings.url === undefined ? '' : settings.url),
              overridden: settings.url !== undefined, disabled: disabled, invalid: false,
              overriddenLabel: t('settings.overridden'), invalidLabel: '',
              onEdit: function (text) { edit('url', text) },
              onReset: function () { resetField('url') },
            }),
            ValueCell({
              id: 'dshdl2-profile', label: t('settings.profile'), hint: t('settings.profileHint'),
              placeholder: '', text: String(settings.profile === undefined ? '' : settings.profile),
              overridden: settings.profile !== undefined, disabled: disabled, invalid: false,
              overriddenLabel: t('settings.overridden'), invalidLabel: '',
              onEdit: function (text) { edit('profile', text) },
              onReset: function () { resetField('profile') },
            }),
            ValueCell({
              id: 'dshdl2-icon', label: t('settings.iconPath'), hint: t('settings.iconPathHint'),
              placeholder: '', text: String(settings.iconPath === undefined ? '' : settings.iconPath),
              overridden: settings.iconPath !== undefined, disabled: disabled, invalid: false,
              overriddenLabel: t('settings.overridden'), invalidLabel: '',
              onEdit: function (text) { edit('iconPath', text) },
              onReset: function () { resetField('iconPath') },
            }),
            React.createElement('div', { className: 'dshdl2-actions' },
              React.createElement('button', {
                type: 'button', className: 'dshdl2-create',
                disabled: view.creating || disabled || !createReady,
                onClick: create,
              }, t(view.creating ? 'settings.creating' : 'settings.create')),
              !createReady && !disabled
                ? React.createElement('p', { className: 'dshdl2-off', role: 'status' }, t('settings.requireEnabled'))
                : null,
              view.created
                ? React.createElement('p', { className: 'dshdl2-ok', role: 'status' },
                    t('settings.created') + ': ' + view.created.path +
                    (view.created.warning ? ' (' + t('settings.warning') + ': ' + view.created.warning + ')' : ''))
                : null,
              view.error
                ? React.createElement('p', { className: 'dshdl2-error', role: 'status' }, t('settings.createFailed') + ': ' + view.error)
                : null
            ),
            React.createElement('hr', { className: 'dshdl2-separator', role: 'separator' }),
            React.createElement('h4', { className: 'dshdl2-sectionTitle' }, t('settings.shutdownSection')),
            BooleanCell({
              id: 'dshdl2-confirm', label: t('settings.confirmShutdown'), hint: t('settings.confirmShutdownHint'),
              inheritLabel: t('settings.inherit'), onLabel: t('settings.on'), offLabel: t('settings.off'),
              text: String(settings.confirmShutdown === undefined ? '' : settings.confirmShutdown),
              overridden: settings.confirmShutdown !== undefined, disabled: disabled, invalid: false,
              overriddenLabel: t('settings.overridden'), invalidLabel: '',
              onEdit: function (text) { edit('confirmShutdown', text === '' ? undefined : text === 'true') },
              onReset: function () { resetField('confirmShutdown') },
            })
          )
        }

        return CollapsibleCard({
          t: t,
          title: t('settings.title'),
          description: t('settings.description'),
          defaultOpen: false,
          dirty: view.dirty,
          children: React.createElement(React.Fragment, null,
            fields,
            !view.dead
              ? React.createElement('div', { className: 'dshdl2-footer' },
                  view.error && view.error.indexOf('saveFailed') !== -1
                    ? React.createElement('p', { className: 'dshdl2-failed', role: 'status' }, view.error)
                    : null,
                  React.createElement('button', {
                    type: 'button', className: 'dshdl2-btn dshdl2-discard',
                    disabled: !view.dirty || view.busy, onClick: discard,
                  }, t('settings.discard')),
                  React.createElement('button', {
                    type: 'button', className: 'dshdl2-btn dshdl2-save',
                    disabled: !view.dirty || view.busy, onClick: save,
                  }, t(view.busy ? 'settings.saving' : 'settings.save'))
                )
              : null
          )
        })
      }

      // ----------------------------------------------------------- plugin
      var inject = ['slots']

      function apply(ctx) {
        // Floating power button: mount directly into document.body with its
        // own React root (the original 0.2.8 floating-mount approach), so it
        // is independent of the sidebar/slots layout and always visible.
        ctx.effect(function () {
          var host = document.createElement('div')
          host.dataset.dshShutdownFloat = 'true'
          document.body.appendChild(host)
          var root = ReactDomClient.createRoot(host)
          root.render(React.createElement(ShutdownEntry, {
            wide: true,
            floating: true,
            confirmShutdown: function () { return true },
            t: function (key) { return T[key] || key },
          }))
          return function () {
            root.unmount()
            host.remove()
          }
        }, 'dsh-desktop-launcher2: floating shutdown')

        // Settings card inside Settings → Plugins → plugin configuration
        // (keyed slot, same pattern as dsh-free-search). CRITICAL: the
        // ConfigurablePluginsTab dispatches cards by SETTINGS NAMESPACE
        // (renderSlot("settings.plugin.item", {}, { entryKey: ns })), so the
        // card key MUST equal the host-registered settings namespace
        // ("desktop-launcher"); anything else is never dispatched and never
        // renders.
        ctx.effect(function () {
          return ctx.slots.inject('settings.plugin.item', function () {
            return ctx.slots.register({
              name: 'settings.plugin.item',
              key: 'desktop-launcher',
              id: 'dsh-desktop-launcher2',
              order: 115,
              inject: function () { return {} },
            }, SettingsCard)
          })
        }, 'dsh-desktop-launcher2: settings card')
      }

      exports.apply = apply
      exports.inject = inject
      return module.exports
    },
  })
}
