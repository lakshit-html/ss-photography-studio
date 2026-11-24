@echo off
title SS Photography - Nikon D750 Live Camera Uploader
color 0A
cd /d "%~dp0"

echo =================================================================
echo    SS PHOTOGRAPHY - NIKON D750 LIVE CAMERA AUTO-UPLOADER
echo =================================================================
echo.
echo Monitored Folder: %~dp0tether_inbox
echo Live Website:     https://ss-photography-studio.vercel.app
echo.
echo * Any photo saved by your camera to tether_inbox will automatically
echo   upload to the website and Google Drive with Face Recognition.
echo * Any photo deleted from tether_inbox will automatically be removed
echo   from the website and cloud gallery!
echo.
echo Press Ctrl+C anytime to stop.
echo -----------------------------------------------------------------
echo.

node uploader\watch-uploader.mjs

pause
