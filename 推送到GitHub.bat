@echo off
chcp 65001 >nul
echo ========================================
echo    竞拍之王计算器 - 推送到 GitHub
echo ========================================
echo.
echo 仓库地址: https://github.com/cccww/auction-king-calculator
echo.
echo [步骤] 正在推送到 GitHub...
echo.
echo 注意：首次推送需要 GitHub 认证
echo.
echo 如果使用 HTTPS 方式，可能需要：
echo 1. GitHub 账号密码（或 Personal Access Token）
echo 2. 或者配置 SSH 密钥
echo.
echo ========================================
echo.

cd /d "%~dp0"
git push -u origin main

echo.
echo ========================================
echo.
if %errorlevel% equ 0 (
    echo ✅ 推送成功！
    echo.
    echo 访问您的仓库:
    echo https://github.com/cccww/auction-king-calculator
    echo.
    echo 接下来可以部署到 Vercel 获得公网访问地址！
) else (
    echo ❌ 推送失败
    echo.
    echo 可能的原因：
    echo 1. 仓库还没有在 GitHub 上创建
    echo 2. 认证失败（需要 Personal Access Token）
    echo 3. 网络问题
    echo.
    echo 请查看 GitHub上传指南.md 获取帮助
)
echo.
pause
