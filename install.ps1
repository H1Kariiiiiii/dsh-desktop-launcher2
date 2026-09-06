# dsh-desktop-launcher2 傻瓜安装脚本
# 用法（复制粘贴一行即装；发布后把下方 <你的用户名> 换成真实用户名即可）：
#   irm https://raw.githubusercontent.com/<你的用户名>/dsh-desktop-launcher2/main/install.ps1 | iex
#
# 也可以先 clone 本仓库再运行：
#   powershell -ExecutionPolicy Bypass -File install.ps1
#
# 参数（可选）：
#   -RepoUrl   仓库地址（默认 DEFAULT_REPO；git clone 场景可自动从 remote 推断）
#   -Branch    分支（默认 main）
#   -Profile   dsh profile 名（默认 web）
param(
    [string]$RepoUrl = "",
    [string]$Branch = "main",
    [string]$Profile = "web"
)

# ==== 发布前请替换为你的真实仓库地址（irm|iex 方式运行时会用到它） ====
$DEFAULT_REPO = "https://github.com/<你的用户名>/dsh-desktop-launcher2.git"

$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['ProgressPreference'] = 'SilentlyContinue'

function Write-Info($m) { Write-Host "[安装器] $m" -ForegroundColor Cyan }
function Write-Err($m) { Write-Host "[安装器] 错误: $m" -ForegroundColor Red }

try {
    # ---------- 0. 确定仓库地址：参数 > 本仓库 remote 推断 > 内置默认 ----------
    if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
        $here = Split-Path -Parent $MyInvocation.MyCommand.Path
        if ($here -and (Test-Path (Join-Path $here ".git"))) {
            $gitArgs = @("-C", $here, "remote", "get-url", "origin")
            $remote = (& git @gitArgs 2>$null) -join ""
            if ($remote -and $remote -match "github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$") {
                $RepoUrl = "https://github.com/" + $Matches[1] + ".git"
                Write-Info "从本仓库 remote 推断: $RepoUrl"
            }
        }
        if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
            if ($DEFAULT_REPO -match "<你的用户名>") {
                Write-Err "DEFAULT_REPO 尚未配置（含占位符）；请先发布仓库并修改本脚本，或使用 -RepoUrl"
                exit 1
            }
            $RepoUrl = $DEFAULT_REPO
            Write-Info "使用默认仓库: $RepoUrl"
        }
    }

    # ---------- 1. 前置检查：dsh ----------
    $dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
    if (-not $dshCmd) {
        Write-Err "未找到 dsh 命令。请先安装 DeepSeek Harness：npm i -g @deepseek-ai/dsh"
        exit 1
    }
    Write-Info "检测到 dsh: $($dshCmd.Source)"

    # ---------- 2. 整理临时目录（看门人：绝不动用户已有安装） ----------
    $tmp = Join-Path $env:TEMP ("dsh-launcher2-install-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    Write-Info "临时目录: $tmp"

    # ---------- 3. 获取源码（git clone 优先，失败退 zip） ----------
    $src = Join-Path $tmp "src"
    try {
        if (Get-Command git -ErrorAction SilentlyContinue) {
            Write-Info "克隆 $RepoUrl (分支 $Branch) ..."
            $cloneArgs = @("clone", "--depth", "1", "--branch", $Branch, $RepoUrl, $src)
            & git @cloneArgs 2>$null
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$src\package.json")) { throw "git clone 失败" }
        } else {
            throw "无 git"
        }
    } catch {
        Write-Info "git clone 失败，改用 zip 下载 ..."
        # 把 github.com 换成 codeload 直接下载 zip（国内常需要镜像可自行改这行）
        $zipUrl = $RepoUrl -replace "^https://github\.com/", "https://codeload.github.com/" -replace "\.git$", ""
        $zipUrl = "$zipUrl/zip/refs/heads/$Branch"
        $zip = Join-Path $tmp "src.zip"
        Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing
        Expand-Archive -Path $zip -DestinationPath $src -Force
        $inner = Get-ChildItem $src -Directory | Select-Object -First 1
        if ($inner) { $src = $inner.FullName }
        if (-not (Test-Path "$src\package.json")) { throw "解压后未找到 package.json" }
    }
    Write-Info "源码就绪: $src"

    # ---------- 4. dsh plugin add（一条命令，自动纳入 bundles 层） ----------
    Write-Info "安装到 profile '$Profile' ..."
    # 直接以数组参数调用 dsh 二进制（原生命令传参），避免带空格路径在 IEX/字符串拼接时被拆开
    $addArgs = @("plugin", "--profile", $Profile, "add", "file:$src")
    & dsh @addArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Err "dsh plugin add 失败（退出码 $LASTEXITCODE）"
        exit 1
    }
    Write-Info "已安装。dsh 已自动将 dsh-desktop-launcher2 加入 profile 的 bundles 层。"

    # ---------- 5. 验证组合层 ----------
    Write-Info "验证组合层 ..."
    $dump = dsh --profile $Profile --dump-config 2>&1 | Out-String
    if ($dump -notmatch "dsh-desktop-launcher2") {
        Write-Err "组合层里未见 dsh-desktop-launcher2；请检查 profile 配置"
        exit 1
    }
    Write-Info "组合层包含 dsh-desktop-launcher2 ✓"

    # ---------- 6. 完成指引 ----------
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "  安装成功！请重启 dsh web 使插件生效：" -ForegroundColor Green
    Write-Host "      dsh web" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  启动后打开 设置 → 插件 → 插件配置 → 桌面启动器：" -ForegroundColor Green
    Write-Host "    - 点击「创建桌面图标」生成桌面快捷方式" -ForegroundColor Green
    Write-Host "    - 页面右下角出现悬浮关机按钮" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green

    # ---------- 7. 清理临时目录 ----------
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    exit 0
} catch {
    Write-Err $_.Exception.Message
    exit 1
}
