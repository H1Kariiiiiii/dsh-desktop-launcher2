# dsh-desktop-launcher2

> DeepSeek Harness **桌面启动器 + 一键关机** 插件：在 Web 设置页创建桌面图标（双击启动 dsh web），带 WPF 风格的启动弹窗；页面右下角悬浮电源按钮，点击确认后优雅退出 dsh 进程。

## 背景

`@linxin666/dsh-web-all` 从 0.3.16 起不再包含桌面启动器（原 `@linxin666/dsh-desktop-launcher@0.2.8` 在 rc.1 认证升级后已不可用：启动脚本打开裸 URL 会 401，client 端依赖的 `@deepseek-ai/dsh-client-runtime` 在 rc.1 中不存在）。本项目以纯 ESM JavaScript 复刻该功能与 UI，适配 DeepSeek Harness **0.1.2-rc.1**（Windows），并修复了上述问题。

## 功能

### 桌面图标（核心）
- 设置页「创建桌面图标」按钮 → 在桌面生成 `DeepSeek-Harness.lnk`（Windows）
- 双击快捷方式：
  1. 探测 `http://127.0.0.1:3080` 是否已有 dsh 在运行
  2. 未运行 → 显示 **DeepSeek Harness 风格启动弹窗**（WPF 深色圆角卡片 + 旋转加载圈 + 状态文字），同时后台启动 `dsh web`
  3. 轮询最多 60 秒，就绪后自动打开浏览器
- 图标/脚本存放在 `~/.dsh/desktop-launcher/`（`launcher2.ps1` + `.lnk` + 图标资源）

### 一键关机
- 页面**右下角悬浮电源按钮**（圆形图标）
- 点击 → 弹出确认框（可配置关闭确认直接退出）
- 确认后 → 调用 `/api/dsh-desktop-launcher2/shutdown` → `ctx.appExit` **优雅退出**（先回收插件树再退出；无 appExit 时回退 `process.exit(0)`）
- 浏览器先收到确认响应再关闭，避免死链错误页

### 配置（设置 → 插件 → 插件配置 → 桌面启动器）
| 字段 | 默认值 | 说明 |
|---|---|---|
| 启用插件 | `true` | 关闭后不再提供桌面图标创建与关机按钮 |
| 向 Agent 公告 | `false` | 关闭后系统提示词不再介绍本插件 |
| dsh 命令 | `dsh` | 启动器调用的命令，需在 PATH 中 |
| Web GUI 地址 | `http://127.0.0.1:3080` | 启动后等待就绪并打开的地址 |
| 启动 profile（可选） | 空 | 留空表示不带 `--profile` 参数 |
| 图标文件（可选） | 空 | 桌面图标的 `.ico/.png` 路径；留空使用内置 dsh 图标 |
| 退出前确认 | `true` | 关闭后点击关机按钮直接退出 |

配置写入 `~/.dsh/settings.yaml` 的 `desktop-launcher` 段（与官方设置面板共享，重启后保留）。

## 安装

```powershell
# 开发/本地使用：作为 file: 依赖安装到 web profile
dsh plugin --profile web add "file:C:/你的路径/dsh-desktop-launcher2"
```

然后在 `C:\Users\<user>\.dsh\profiles\web\package.json` 的 `dsh.profile.bundles` 里加入 `dsh-desktop-launcher2`，重启 dsh。

> 插件以 `file:` 依赖 + `dsh.bundle`（`cordis.patch.yml`）加载；`dsh.client.inject` 保持 `[]`（client bundle 只需 `react`/`react-dom` seed words）。

## 兼容性说明

基于 **rc.1 运行时实测**，兼容矩阵：

| 层 | 状态 |
|---|---|
| host 路由（`ctx.webServer.register`，exact） | ✅ 稳定（核心 API） |
| settings 注册（`installSection` / `register` 双路径） | ✅ 特性检测，缺失时降级 |
| `ctx.appExit` | ✅ 可选读取，缺失时 `process.exit` 兜底 |
| `ctx.systemPrompt` | ✅ 可选读取，仅公告开启时使用 |
| client bundle 协议（`window.__ModuleLoader__.load` 惰性 CJS） | ⚠️ 私有协议，随 dsh 版本可能变化 |
| client 槽位（`settings.plugin.item`，keyed） | ⚠️ 契约细节（key 必须等于 settings 命名空间）可能变化 |
| 桌面快捷方式（`launcher2.ps1`） | ✅ 独立 PowerShell，不依赖插件存活 |

**降级保障**：即使 client UI 全部失效，`launcher2.ps1` 仍可独立启动 dsh web（只调用 `dsh` 命令）。

本机验证项目：宿主 `dsh 0.1.2-rc.1`、Node v24.19.0、Windows PowerShell 5.1+。

## 目录结构

```
dsh-desktop-launcher2/
├── lib/
│   ├── index.js        # host 入口：路由、settings 注册、公告
│   ├── client.js       # client bundle：设置卡片 + 悬浮关机按钮
│   └── host/state.js   # launcher 脚本生成（PowerShell / POSIX）
├── assets/             # dsh.ico / dsh.png（内置图标）
├── cordis.patch.yml    # bundle patch 层
├── package.json        # 插件清单（file: 加载）
└── LICENSE             # Apache-2.0
```

## 致谢

- 功能与 UI 移植自 [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) 仓库的 `@linxin666/dsh-desktop-launcher@0.2.8`（Apache-2.0）。本项目的 launcher 弹窗、快捷方式安装器、悬浮关机按钮等设计均来自该包，并按 `dsh 0.1.2-rc.1` API 重写为纯 ESM JavaScript。
- 图标资源（`dsh.ico`/`dsh.png`）沿用原包内置素材。

## License

[Apache-2.0](LICENSE)（与原版一致；代码含原包移植部分，保留原版权声明）。
