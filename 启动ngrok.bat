@echo off
chcp 65001 >nul
echo ========================================
echo    竞拍之王计算器 - ngrok 远程访问
echo ========================================
echo.
echo [步骤1] 正在检查开发服务器...
echo.
echo 确保您的开发服务器已经在运行中！
echo 开发服务器地址: http://localhost:5173
echo.
echo [步骤2] 启动 ngrok
echo.
echo ngrok 将会为您提供一个公网访问地址
echo 请将 ngrok.exe 放在和此脚本相同的目录
echo.
echo ========================================
echo.

if exist "ngrok.exe" (
    echo 找到 ngrok.exe，正在启动...
    echo.
    ngrok http 5173
) else (
    echo.
    echo ❌ 错误：没有找到 ngrok.exe
    echo.
    echo 请按照以下步骤操作：
    echo 1. 访问 https://ngrok.com/download
    echo 2. 下载 Windows 版本的 ngrok
    echo 3. 解压 ngrok.exe 到此目录
    echo 4. 重新运行此脚本
    echo.
    pause
)
