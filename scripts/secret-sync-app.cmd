@echo off
setlocal
cd /d "%~dp0\.."
node scripts\secret-sync-app.mjs
echo.
echo GoldShore Secret Sync stopped.
pause
