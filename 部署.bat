@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo    🚀 GitHub Pages 部署脚本
echo ==========================================
echo.

REM 检查是否已经初始化Git
if not exist .git (
    echo ❌ 错误：尚未初始化Git仓库
    echo.
    echo 请先运行以下命令：
    echo   git init
    echo   git add .
    echo   git commit -m "初始提交"
    echo   git remote add origin https://github.com/XFKI/couple-ordering.git
    echo   git push -u origin main
    echo.
    pause
    exit /b 1
)

echo 📝 提交代码到Git...
git add .
git commit -m "更新: %date% %time%"
git push origin main
echo.

echo 📦 开始构建项目...
call npm run build
if errorlevel 1 (
    echo.
    echo ❌ 构建失败！请检查错误信息
    pause
    exit /b 1
)

echo.
echo ✅ 构建成功！
echo.
echo 🚀 开始部署到GitHub Pages...
call npx gh-pages -d dist
if errorlevel 1 (
    echo.
    echo ❌ 部署失败！
    echo.
    echo 常见问题：
    echo 1. 检查是否已推送代码到GitHub
    echo 2. 检查仓库名是否正确
    echo 3. 检查网络连接
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    ✅ 部署成功！
echo ==========================================
echo.
echo 📱 访问你的网站：
echo    https://xfki.github.io/couple-ordering/
echo.
echo 💡 提示：
echo    - 等待2-3分钟即可看到更新
echo    - 刷新页面时按 Ctrl+Shift+R 强制刷新
echo    - 修改代码后直接双击此脚本即可
echo.
pause
