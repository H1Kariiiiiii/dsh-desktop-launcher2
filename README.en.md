# dsh-icon-console

> Icon console for the **DeepSeek Harness desktop application**: import an icon once and apply it to the desktop shortcut, the Start Menu shortcut, the application window image and the system tray image — plus one-click restart and graceful exit.

[中文](README.md) · **English**

<!-- Repo Topics suggestion (repo page → About → Topics): dsh · dsh-plugin · deepseek-harness · desktop · icon · tray -->

## ⚡ Install (copy this single line)

```powershell
pwsh -File ~\.dsh\tools\dsh-desktop-cli.ps1 plugin --profile desktop add github:H1Kariiiiiii/dsh-icon-console
```

> The desktop profile is managed exclusively by the Electron application, so an ordinary `dsh` command refuses to touch it — hence the desktop's own CLI. Restart the desktop app afterwards.

## Features

### Icon customization (core)

| Target | Takes effect | Notes |
|---|---|---|
| **Desktop shortcut** | Immediately | Rewrites `IconLocation` on `DeepSeek Harness.lnk` |
| **Start Menu shortcut** | Immediately | Same mechanism |
| **Application window icon** | After restart | Replaces `<install>/resources/icon.png` (window & taskbar) |
| **System tray icon** | After restart | Replaces `<install>/resources/tray.ico` |

- **Import**: upload from this machine (file picker, base64) or type a disk path
- **Formats**: shortcuts need `.ico`; window/tray images accept `.ico` and `.png`
- **Automatic backup**: the pristine icons are copied to `~/.dsh/icon-console/backup/` on first run
- **One-click restore**: put the official icons back (shortcuts immediately; window/tray after restart)
- **Icon library**: keep favourites in `~/.dsh/icon-console/library/`, reuse or delete them anytime

### Application control

- **Restart**: ends the current Host process; the desktop shell then shows its official recovery dialog — click 重启 / Restart (that is the default button, so Enter is enough)
- **Exit**: ends the Host process gracefully

> Why is restart implemented this way? The window and process lifecycle belong to the Electron shell; plugins run inside the Host child. The official market (dsh-market) hard-codes `allowRestart: false` under a desktop host for exactly this reason — relaunching a raw Electron process would bypass the desktop's launcher lifecycle. So this plugin hands the restart back to the shell's own recovery flow, which is the lifecycle-correct path.

### Configuration (Settings → Plugins → plugin configuration → Icon console)

| Field | Default | Description |
|---|---|---|
| Enable plugin | `true` | Master switch |
| Auto re-apply | `false` | Re-apply the remembered icon when a shortcut is found pointing elsewhere |
| Include Start Menu | `true` | Process the Start Menu shortcut together with the desktop one |

Settings live in `~/.dsh/icon-console/state.json` and in the settings form (volatile fields).

## Installation

> Requires the DeepSeek Harness **desktop application** (Electron). Every HTTP route is loopback-only.

### Recommended: install from GitHub

```powershell
# The desktop profile is Electron-owned; use the desktop's own CLI
pwsh -File ~\.dsh\tools\dsh-desktop-cli.ps1 plugin --profile desktop add github:H1Kariiiiiii/dsh-icon-console

# Then restart the desktop app
```

### Development: install from local source

```powershell
pwsh -File ~\.dsh\tools\dsh-desktop-cli.ps1 plugin --profile desktop add "file:C:/path/dsh-icon-console"
```

> A `file:` dependency is **copied** (not linked) across drives, so after editing source re-run `add` (or delete `node_modules/dsh-icon-console` and `pnpm install`) to sync.

### Verify after install

```powershell
# The composed layer should list dsh-icon-console
pwsh -File ~\.dsh\tools\verify-desktop-profile.mjs
```

After restarting the desktop app, open **Settings → Plugins → plugin configuration**; the "Icon console" card should be there.

### Uninstall

```powershell
pwsh -File ~\.dsh\tools\dsh-desktop-cli.ps1 plugin --profile desktop remove dsh-icon-console
# The icon library and backups stay in ~/.dsh/icon-console/ — delete manually if unwanted
```

## Compatibility

Verified against **desktop 0.2.0-rc.2** (bundled DSH runtime):

| Layer | Status |
|---|---|
| Host routes (`ctx.webServer.register`, exact + loopback fence) | ✅ Stable |
| Settings form (0.1.7+ `.volatile()` + `describe()` / `update()` contract) | ✅ Implemented against the new contract |
| `ctx.appExit` | ✅ Optional read, `process.exit` fallback |
| Client bundle (`window.__ModuleLoader__.load` lazy CJS factory) | ⚠️ Private protocol, may change |
| Client slot (`settings.section`, shared with third-party cards such as wallpaper-engine) | ⚠️ Contract details may change |
| Icon file replacement (`resources/`) | ✅ Directory is writable; an app upgrade overwrites it, just apply again |

**Degradation guarantee**: even if the client UI breaks entirely, icons can still be applied through the HTTP routes; shortcut icons never require an app restart.

## FAQ

**Q: I selected a window/tray icon but nothing changed.**
A: Those two require an **application restart** (Electron reads them once at startup). Use the "Restart" button, or restart manually.

**Q: The shortcut icon did not refresh.**
A: Windows Explorer caches icons. Press `F5` on the desktop, or restart Explorer (`taskkill /f /im explorer.exe & start explorer`).

**Q: "Installation directory not found".**
A: Window/tray icons need a locatable install root. Point `DSH_DESKTOP_INSTALL` at the directory containing `resources/`.

**Q: Can a PNG be used for a shortcut?**
A: No — Windows shortcuts only accept `.ico`. A `.png` works for the window and tray images.

**Q: An app upgrade reverted my icons.**
A: Upgrades replace `resources/`. Apply the icon again; the pristine backup stays in `~/.dsh/icon-console/backup/`.

## Background

- This plugin was converted from `dsh-desktop-launcher2` (a desktop launcher for the **dsh web** era). The desktop application already starts from a double click and ships its own startup screen and tray-quit entry, so "create a launcher shortcut and open a browser" had no purpose left.
- It now focuses on what the desktop genuinely lacks: **icon customization** (window / tray / shortcuts) and **convenient application control**.
- The original launcher was ported from `@linxin666/dsh-desktop-launcher@0.2.8` (Apache-2.0). The current code is rewritten against the desktop 0.2.0 architecture; only the license and credit remain.

## Structure

```
dsh-icon-console/
├── lib/
│   ├── index.js         # host entry: routes, settings (volatile contract), backup
│   ├── client.js        # client bundle: settings card UI
│   └── host/
│       ├── icons.js     # icon validation / backup / shortcut(.lnk) / resources writes
│       └── restart.js   # exit and shell-mediated restart
├── assets/              # bundled dsh icons
├── cordis.patch.yml     # bundle patch layer
├── package.json
└── LICENSE              # Apache-2.0
```

## Credits

- The original launcher's functionality and UI were ported from `@linxin666/dsh-desktop-launcher@0.2.8` (Apache-2.0) in the [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) repository.
- Icon assets come from that package.

## License

[Apache-2.0](LICENSE) (ported parts retain their original copyright notice).
