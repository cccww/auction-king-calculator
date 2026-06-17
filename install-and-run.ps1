# 竞拍之王计算器 - 自动安装和启动脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  竞拍之王计算器 - 自动安装和启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否已安装 Node.js
Write-Host "[1/4] 检查 Node.js..." -ForegroundColor Yellow
$nodeInstalled = $false
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "[OK] Node.js 已安装: $nodeVersion" -ForegroundColor Green
        $nodeInstalled = $true
    }
} catch {
    Write-Host "[提示] 未检测到 Node.js" -ForegroundColor Yellow
}

# 如果未安装，尝试下载和安装 Node.js
if (-not $nodeInstalled) {
    Write-Host ""
    Write-Host "[2/4] 正在下载 Node.js 安装程序..." -ForegroundColor Yellow
    
    $nodeUrl = "https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi"
    $installerPath = "$env:TEMP\node-installer.msi"
    
    try {
        Write-Host "正在从 $nodeUrl 下载..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath -UseBasicParsing
        Write-Host "[OK] 下载完成" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "[3/4] 正在安装 Node.js... (需要管理员权限)" -ForegroundColor Yellow
        Write-Host "请在弹出的安装窗口中点击 'Next' 完成安装" -ForegroundColor Cyan
        
        Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Wait
        
        Write-Host "[OK] Node.js 安装完成" -ForegroundColor Green
        
        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Host ""
        Write-Host "[提示] 请重新打开终端以加载 Node.js，或手动运行 'npm run dev'" -ForegroundColor Yellow
        Write-Host ""
        
        # 清理安装文件
        Remove-Item $installerPath -ErrorAction SilentlyContinue
        
    } catch {
        Write-Host "[错误] 自动安装失败，请手动安装 Node.js" -ForegroundColor Red
        Write-Host "访问 https://nodejs.org/ 下载并安装 LTS 版本" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "在安装完成后，双击 '启动.bat' 即可运行" -ForegroundColor Yellow
        Write-Host ""
        pause
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "[2/4] 跳过下载（Node.js 已安装）" -ForegroundColor Green
}

# 检查依赖是否已安装
Write-Host ""
Write-Host "[3/4] 检查项目依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装依赖..." -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] 依赖安装完成" -ForegroundColor Green
    } else {
        Write-Host "[警告] 依赖安装可能有问题，但将尝试继续" -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] 依赖已存在" -ForegroundColor Green
}

# 启动开发服务器
Write-Host ""
Write-Host "[4/4] 正在启动开发服务器..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  服务器即将启动！" -ForegroundColor Cyan
Write-Host "  请在浏览器中访问: http://localhost:5173/" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Gray
Write-Host ""

npm run dev
