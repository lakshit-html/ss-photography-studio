@echo off
echo =====================================================================
echo       SS PHOTOGRAPHY — STOPPING LIVE CLOUDFLARE SERVICE
echo =====================================================================
echo.
echo Stopping Cloudflare tunnel...
taskkill /F /IM cloudflared.exe > nul 2>&1

echo Stopping Next.js server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a > nul 2>&1
)

echo.
echo [STOPPED] SS Photography background live service stopped.
pause
