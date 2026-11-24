@echo off
title Stop SS Photography Background Uploader
color 0C
cd /d "%~dp0"

echo Stopping any running camera uploader processes...
wmic process where "commandline like '%%watch-uploader.mjs%%'" call terminate >nul 2>&1
echo Done! Camera uploader is stopped.
echo.
pause
