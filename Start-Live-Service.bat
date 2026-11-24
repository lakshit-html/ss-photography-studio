@echo off
echo =====================================================================
echo       SS PHOTOGRAPHY — STARTING LIVE CLOUDFLARE SERVICE
echo =====================================================================
echo.
echo Starting live website and Cloudflare tunnel silently in background...
wscript.exe "%~dp0scripts\run-live-background.vbs"

echo Waiting 5 seconds for Cloudflare tunnel to initialize...
timeout /t 5 /nobreak > nul

if exist "%~dp0LIVE_URL.txt" (
    echo.
    type "%~dp0LIVE_URL.txt"
) else (
    echo.
    echo Service started in background!
    echo Check "LIVE_URL.txt" in a few seconds for your live public link.
)
echo.
echo [DONE] The website is now live in the background. You can close this window.
pause
