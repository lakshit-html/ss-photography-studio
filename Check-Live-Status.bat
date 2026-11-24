@echo off
echo =====================================================================
echo       SS PHOTOGRAPHY — LIVE BACKGROUND SERVICE STATUS
echo =====================================================================
echo.

tasklist /FI "IMAGENAME eq cloudflared.exe" 2>NUL | find /I /N "cloudflared.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [STATUS] Cloudflare Tunnel: ONLINE & RUNNING
) else (
    echo [STATUS] Cloudflare Tunnel: OFFLINE
)

netstat -aon | findstr ":3000" | findstr "LISTENING" >nul
if "%ERRORLEVEL%"=="0" (
    echo [STATUS] Next.js Web Server: ONLINE (Port 3000)
) else (
    echo [STATUS] Next.js Web Server: OFFLINE
)

echo.
if exist "%~dp0LIVE_URL.txt" (
    type "%~dp0LIVE_URL.txt"
) else (
    echo No active LIVE_URL.txt found. Run "Start-Live-Service.bat" to start.
)

echo.
pause
