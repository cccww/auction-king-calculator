@echo off
title 竞拍之王计算器 - 快速安装指南
color 0A

echo ========================================
echo    竞拍之王计算器 - 快速安装指南
echo ========================================
echo.

echo [步骤 1/3] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [提示] 未检测到 Node.js
    echo.
    echo 正在打开 Node.js 官网...
    start https://nodejs.org/
    echo.
    echo ========================================
    echo 请按以下步骤操作：
    echo.
    echo 1. 在打开的网页中下载 LTS 版本
    echo 2. 运行安装程序，一路点击 Next
    echo 3. 安装完成后，重新打开此文件
    echo.
    echo ========================================
    echo.
    pause
    exit
)

echo [OK] Node.js 已安装
node --version
echo.

echo [步骤 2/3] 检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo [警告] 依赖安装可能有问题
    )
)
echo [OK] 依赖已就绪
echo.

echo [步骤 3/3] 启动服务器...
echo.
echo ========================================
echo   启动成功！请访问: http://localhost:5173/
echo ========================================
echo.
echo 按 Ctrl+C 停止服务器
echo.

call npm run dev

pause
