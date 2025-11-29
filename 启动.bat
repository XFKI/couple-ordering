@echo off
chcp 65001 >nul
echo ========================================
echo 🍽️ 情侣点餐系统 - 快速启动脚本
echo ========================================
echo.

echo [1/3] 检查 Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未安装 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js 已安装

echo.
echo [2/3] 安装依赖包...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)
echo ✅ 依赖安装完成

echo.
echo [3/3] 启动开发服务器...
echo 🚀 服务器将在 http://localhost:3000 启动
echo 💡 按 Ctrl+C 可停止服务器
echo.
call npm run dev

pause
