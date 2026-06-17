@echo off
title 竞拍之王计算器 - 智能启动
color 0A

echo ========================================
echo    竞拍之王计算器 - 智能启动
echo ========================================
echo.

:: 尝试多种方式找到 Node.js
echo [1/4] 正在查找 Node.js...
set NODE_PATH=

:: 检查常见安装位置
if exist "C:\Program Files\nodejs\node.exe" (
    set NODE_PATH=C:\Program Files\nodejs
    goto found_node
)
if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set NODE_PATH=C:\Program Files (x86)\nodejs
    goto found_node
)
if exist "%LOCALAPPDATA%\nodejs\node.exe" (
    set NODE_PATH=%LOCALAPPDATA%\nodejs
    goto found_node
)
if exist "%APPDATA%\npm\node.exe" (
    set NODE_PATH=%APPDATA%\npm
    goto found_node
)

:: 尝试从 PATH 中找到
where node >nul 2>&1
if not errorlevel 1 (
    goto found_node
)

:: 没找到的情况
echo [错误] 未找到 Node.js！
echo.
echo 请确保已安装 Node.js：
echo 1. 访问 https://nodejs.org/
echo 2. 下载并安装 LTS 版本
echo 3. 重新运行此脚本
echo.
pause
exit /b 1

:found_node
if not "%NODE_PATH%"=="" (
    echo [OK] 在 %NODE_PATH% 找到 Node.js
    set "PATH=%NODE_PATH%;%PATH%"
)

:: 检查 Node.js 版本
echo.
echo [2/4] 检查 Node.js...
node --version
if errorlevel 1 (
    echo [错误] Node.js 无法运行
    pause
    exit /b 1
)
echo [OK] Node.js 正常
npm --version

:: 检查依赖
echo.
echo [3/4] 检查项目依赖...
if not exist "node_modules" (
    echo 正在安装依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo [警告] 依赖安装可能有问题，尝试继续...
    )
)
echo [OK] 依赖已就绪

:: 启动服务器
echo.
echo [4/4] 正在启动开发服务器...
echo.
echo ========================================
echo   服务器启动中...
echo   请访问: http://localhost:5173/
echo ========================================
echo.
echo 按 Ctrl+C 停止服务器
echo.

call npm run dev

pause
