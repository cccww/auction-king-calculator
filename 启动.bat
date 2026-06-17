@echo off
title 竞拍之王计算器
color 0A

echo ================================================
echo    竞拍之王计算器 - 本地启动程序
echo ================================================
echo.

cd /d "%~dp0"

echo [1/3] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未安装 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js 已安装

echo.
echo [2/3] 检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖，请稍候...
    npm install --no-frozen-lockfile
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        echo 尝试: npm install --registry=https://registry.npmmirror.com
        pause
        exit /b 1
    )
)
echo [OK] 依赖已就绪

echo.
echo [3/3] 启动服务器...
echo.
echo ================================================
echo  启动成功！请访问: http://localhost:5173/
echo ================================================
echo.
echo 按 Ctrl+C 停止服务器
echo.

npm run dev

pause
