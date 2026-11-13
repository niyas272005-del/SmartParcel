@echo off
title SmartParcel System Shutdown
echo Stopping SmartParcel processes...

REM Terminate Java Spring Boot process
taskkill /F /IM java.exe >nul 2>nul
if %ERRORLEVEL% equ 0 echo Java backend stopped.

REM Terminate Node Vite process
taskkill /F /IM node.exe >nul 2>nul
if %ERRORLEVEL% equ 0 echo Node frontend stopped.

echo All SmartParcel application processes stopped.
pause

