# 提交 awesome-dsh-plugin 的 PR 描述（可直接粘贴到 GitHub PR 描述框）

## 中文

新增条目：`data/plugins/H1Kariiiiiii__dsh-desktop-launcher2.yml`

- 插件：dsh-desktop-launcher2 —— DeepSeek Harness 桌面启动器 + 一键关机
- 功能：设置页一键创建 Windows 桌面快捷方式（双击启动 dsh web），带 WPF 风格启动弹窗（进度提示、60s 超时、失败/超时提示）；页面右下角悬浮关机按钮，确认后经 `ctx.appExit` 优雅退出 dsh 进程
- 分类：`ui`（UI Enhancements / 桌面启动器类，与 `ayingQAQ/dsh-web-launcher` 同类）
- 安装：`dsh plugin --profile web add github:H1Kariiiiiii/dsh-desktop-launcher2`
- 声明：`dsh.bundle` 已声明（`cordis.patch.yml` 在仓库根）；纯 ESM JS（无需构建）；`dsh-plugin` topic 已在仓库添加
- 描述已按实际代码核对：`/api/dsh-desktop-launcher2/{status,install,shutdown,settings}` 四个路由均存在

## English

Add entry: `data/plugins/H1Kariiiiiii__dsh-desktop-launcher2.yml`

- Plugin: dsh-desktop-launcher2 — desktop launcher + one-click shutdown for DeepSeek Harness
- What it does: creates a Windows desktop shortcut (.lnk) with a WPF-style startup popup (progress, 60s timeout, error/timeout message), plus a floating power button that exits dsh gracefully via `ctx.appExit`
- Category: `ui` (same as `ayingQAQ/dsh-web-launcher`)
- Install: `dsh plugin --profile web add github:H1Kariiiiiii/dsh-desktop-launcher2`
- `dsh.bundle` manifest declared (`cordis.patch.yml` at repo root); plain ESM JS, no build step; `dsh-plugin` topic added to the repo
- Description verified against code: `/api/dsh-desktop-launcher2/{status,install,shutdown,settings}` all exist
