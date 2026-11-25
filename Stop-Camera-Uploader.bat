@echo off
title Stop SS Photography Background Uploader
color 0C
cd /d "%~dp0"

echo Stopping any running camera uploader processes...
if exist uploader\uploader.pid (
  for /f "usebackq delims=" %%p in ("uploader\uploader.pid") do (
    taskkill /F /PID %%p >nul 2>&1
  )
  del /q uploader\uploader.pid >nul 2>&1
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"CommandLine LIKE '%%watch-uploader%%'\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo Done! Camera uploader is stopped.
echo.
pause
