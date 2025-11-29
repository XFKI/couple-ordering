@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo    📦 Git 仓库初始化脚本
echo ==========================================
echo.

REM 检查Git是否安装
where git >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到Git！
    echo.
    echo 请先安装Git：
    echo   1. 访问 https://git-scm.com/download/win
    echo   2. 下载并安装Git for Windows
    echo   3. 安装完成后重启命令行
    echo.
    pause
    exit /b 1
)

echo ✅ Git已安装
echo.

REM 初始化Git仓库
if exist .git (
    echo ⚠️  Git仓库已存在，跳过初始化
) else (
    echo 📦 正在初始化Git仓库...
    git init
    if errorlevel 1 (
        echo ❌ 初始化失败！
        pause
        exit /b 1
    )
    echo ✅ Git仓库初始化成功
)

echo.
echo 📝 配置Git用户信息...
echo.
echo 请输入你的GitHub用户名（例如：XFKI）：
set /p username=
git config user.name "%username%"

echo.
echo 请输入你的GitHub邮箱：
set /p email=
git config user.email "%email%"

echo.
echo ✅ Git配置完成
echo.

echo 📁 添加所有文件到Git...
git add .
if errorlevel 1 (
    echo ❌ 添加文件失败！
    pause
    exit /b 1
)
echo ✅ 文件添加成功

echo.
echo 💾 创建初始提交...
git commit -m "PWA初始版本：情侣点餐系统"
if errorlevel 1 (
    echo ❌ 提交失败！
    pause
    exit /b 1
)
echo ✅ 提交成功

echo.
echo 🔗 关联远程仓库...
git remote add origin https://github.com/XFKI/couple-ordering.git
if errorlevel 1 (
    echo ⚠️  远程仓库可能已添加，尝试更新...
    git remote set-url origin https://github.com/XFKI/couple-ordering.git
)
echo ✅ 远程仓库关联成功

echo.
echo 🚀 推送到GitHub...
echo.
echo ⚠️  请确保：
echo   1. 你已创建 https://github.com/XFKI/couple-ordering 仓库
echo   2. 你已登录GitHub账号
echo.
pause

git push -u origin main
if errorlevel 1 (
    echo.
    echo ⚠️  推送到main分支失败，尝试master分支...
    git branch -M main
    git push -u origin main
    if errorlevel 1 (
        echo.
        echo ❌ 推送失败！
        echo.
        echo 可能的原因：
        echo   1. GitHub仓库不存在
        echo   2. 没有推送权限
        echo   3. 需要先在GitHub上创建Personal Access Token
        echo.
        echo 请访问：https://github.com/settings/tokens
        echo 创建Token后，使用以下命令推送：
        echo   git push -u origin main
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ==========================================
echo    ✅ Git初始化完成！
echo ==========================================
echo.
echo 📋 下一步：
echo   1. 确认代码已推送到GitHub
echo   2. 双击运行 "部署.bat" 进行部署
echo.
pause
