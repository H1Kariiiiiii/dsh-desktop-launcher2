# dsh-icon-console

> DeepSeek Harness 桌面端 **图标控制台**：导入一个图标，一键应用到桌面快捷方式、开始菜单快捷方式、应用窗口图标与系统托盘图标；附带一键重启与优雅退出。

**中文** · [English](README.en.md)

<!-- 仓库 Topics 建议（GitHub 仓库页 About → Topics）：dsh · dsh-plugin · deepseek-harness · desktop · icon · tray -->

## ⚡ 安装（复制这一行即可）

```powershell
pwsh -File ~\.dsh\tools\dsh-desktop-cli.ps1 plugin --profile desktop add github:H1Kariiiiiii/dsh-icon-console
```

> 桌面端 profile 由 Electron 独占管理，普通 `dsh` 命令会被拒绝，因此使用桌面端自带 CLI。装完**重启桌面端**即可。

## 功能

### 图标自定义（核心）

| 目标 | 生效时机 | 说明 |
|---|---|---|
| **桌面快捷方式** | 立即 | 改写 `DeepSeek Harness.lnk` 的 `IconLocation` |
| **开始菜单快捷方式** | 立即 | 同上 |
| **应用窗口图标** | 需重启 | 替换 `<安装目录>/resources/icon.png`（窗口与任务栏） |
| **系统托盘图标** | 需重启 | 替换 `<安装目录>/resources/tray.ico` |

- **导入方式**：本地上传（文件选择器，base64 上传）或直接填写磁盘路径
- **格式支持**：快捷方式图标需要 `.ico`；应用/托盘图标支持 `.ico` 与 `.png`
- **自动备份**：首次运行即把官方图标备份到 `~/.dsh/icon-console/backup/`
- **一键恢复**：随时还原官方图标（快捷方式立即生效，应用/托盘图标需重启）
- **图标库**：把常用图标存到 `~/.dsh/icon-console/library/`，随时调用或删除

### 应用控制

- **重启应用**：结束当前 Host 进程，桌面端随后弹出官方恢复对话框——点「重启」即可（默认按钮就是重启，直接回车）
- **退出应用**：优雅结束 Host 进程

> 为什么重启是这样做的？桌面端的窗口与进程生命周期由 Electron 外壳拥有，插件跑在 Host 子进程里。官方市场（dsh-market）在桌面端同样把 `allowRestart` 硬编码为 `false`，理由是「重启原生 Electron 进程会绕过桌面端的启动器生命周期」。因此本插件不自行拉起 Electron，而是把重启交回外壳的官方恢复流程——这是生命周期正确的做法。

### 配置（设置 → 插件 → 插件配置 → 图标控制台）

| 字段 | 默认值 | 说明 |
|---|---|---|
| 启用插件 | `true` | 总开关 |
| 自动重应用 | `false` | 发现快捷方式图标被改动时自动恢复为记住的图标 |
| 快捷方式含开始菜单 | `true` | 处理桌面快捷方式时一并处理开始菜单 |

配置同时保存在 `~/.dsh/icon-console/state.json` 与 settings 表单（volatile 字段）。

## 安装

> 需要 DeepSeek Harness **桌面端**（Electron）。所有 HTTP 路由仅限 loopback。

### 推荐：从 GitHub 安装

```powershell
# 桌面端 profile 由 Electron 独占管理，用桌面端自带 CLI
pwsh -File ~\.dsh\tools\dsh-desktop-cli.ps1 plugin --profile desktop add github:H1Kariiiiiii/dsh-icon-console

# 然后重启桌面端
```

### 开发：本地源码安装

```powershell
pwsh -File ~\.dsh\tools\dsh-desktop-cli.ps1 plugin --profile desktop add "file:C:/路径/dsh-icon-console"
```

> `file:` 依赖跨盘符时 pnpm 是**复制**而非链接；改源码后需重跑一次 `add`（或删掉 `node_modules/dsh-icon-console` 再 `pnpm install`）才会同步。

### 安装后验证

```powershell
# 组合层应出现 dsh-icon-console
pwsh -File ~\.dsh\tools\verify-desktop-profile.mjs
```

重启桌面端后进入 **设置 → 插件 → 插件配置**，应看到「图标控制台」卡片。

### 卸载

```powershell
pwsh -File ~\.dsh\tools\dsh-desktop-cli.ps1 plugin --profile desktop remove dsh-icon-console
# 图标库与备份保留在 ~/.dsh/icon-console/，可手动删除
```

## 兼容性说明

基于 **桌面端 0.2.0-rc.2**（内嵌 DSH 运行时）实测：

| 层 | 状态 |
|---|---|
| host 路由（`ctx.webServer.register`，exact + loopback 围栏） | ✅ 稳定 |
| settings 表单（0.1.7+ 的 `.volatile()` + `describe()` / `update()` 契约） | ✅ 已按新契约实现 |
| `ctx.appExit` | ✅ 可选读取，缺失时 `process.exit` 兜底 |
| client bundle（`window.__ModuleLoader__.load` 惰性 CJS 工厂） | ⚠️ 私有协议，随版本可能变化 |
| client 槽位（`settings.section`，与 wallpaper-engine 等第三方卡同槽） | ⚠️ 契约细节可能变化 |
| 图标文件替换（`resources/`） | ✅ 目录可写；应用升级会覆盖，重跑「应用图标」即可 |

**降级保障**：即使 client UI 完全失效，图标仍可通过 HTTP 路由直接操作；快捷方式图标不依赖应用重启。

## 常见问题

**Q: 应用/托盘图标选了但没变化？**
A: 这两项需要**重启应用**（Electron 启动时只读取一次）。用卡片里的「重启应用」按钮，或手动重启。

**Q: 快捷方式图标不刷新？**
A: Windows 资源管理器有图标缓存。按 `F5` 刷新桌面，或重启资源管理器（`taskkill /f /im explorer.exe & start explorer`）。

**Q: 提示「未找到 DSH 桌面端安装目录」？**
A: 应用/托盘图标需要定位安装目录。可用环境变量 `DSH_DESKTOP_INSTALL` 指定安装根（含 `resources/` 的那一层）。

**Q: PNG 不能用作快捷方式图标？**
A: Windows 快捷方式只接受 `.ico`；`.png` 可用于应用窗口与托盘图标。

**Q: 升级桌面端后图标变回官方了？**
A: 应用升级会替换 `resources/`。重新点「应用图标」即可；官方图标备份一直保留在 `~/.dsh/icon-console/backup/`。

## 背景

- 本插件由 `dsh-desktop-launcher2`（dsh **web** 时代的桌面启动器）改造而来。桌面端（Electron）本身即可双击启动，自带启动画面与托盘退出，原先「创建启动快捷方式 + 打开浏览器」的定位已无意义。
- 改造后聚焦桌面端真正缺少的能力：**图标自定义**（应用 / 托盘 / 快捷方式）与**便捷的应用控制**。
- 原始启动器移植自 `@linxin666/dsh-desktop-launcher@0.2.8`（Apache-2.0）；当前代码已按桌面端 0.2.0 架构重写，仅保留其授权与致谢。

## 目录结构

```
dsh-icon-console/
├── lib/
│   ├── index.js         # host 入口：路由、settings（volatile 契约）、备份
│   ├── client.js        # client bundle：设置卡片 UI
│   └── host/
│       ├── icons.js     # 图标校验 / 备份 / 快捷方式(.lnk) / resources 写入
│       └── restart.js   # 退出与外壳中介的重启
├── assets/              # 内置 dsh 图标
├── cordis.patch.yml     # bundle patch 层
├── package.json
└── LICENSE              # Apache-2.0
```

## 致谢

- 原始启动器功能与 UI 移植自 [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) 仓库的 `@linxin666/dsh-desktop-launcher@0.2.8`（Apache-2.0）。
- 图标资源沿用该包内置素材。

## License

[Apache-2.0](LICENSE)（保留原包移植部分的版权声明）。
