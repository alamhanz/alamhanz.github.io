@echo off
rem Double-click to start the local blog manager (opens http://127.0.0.1:4322).
rem Close this window or press Ctrl+C to stop it.
title Blog manager
cd /d "%~dp0"

where npm >nul 2>nul || (
  echo Node.js / npm not found. Install Node.js 22.12 or newer, then try again.
  pause
  exit /b 1
)

rem Install packages when node_modules is missing or older than package-lock.json (e.g. after a git pull).
powershell -NoProfile -Command "$m='node_modules/.package-lock.json'; if (!(Test-Path $m) -or (Get-Item package-lock.json).LastWriteTime -gt (Get-Item $m).LastWriteTime) { exit 1 }"
if errorlevel 1 (
  echo Installing packages...
  call npm ci || (pause & exit /b 1)
)

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 3; Start-Process 'http://127.0.0.1:4322'"
call npm run blog
pause
