@echo off
cd /d "%~dp0.."
if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" uploader\watch-uploader.mjs
) else (
  node uploader\watch-uploader.mjs
)
