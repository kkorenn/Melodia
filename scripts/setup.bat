@echo off
setlocal

set "ROOT_DIR=%~dp0.."
cd /d "%ROOT_DIR%"

node scripts\cli.js setup %*
exit /b %errorlevel%
