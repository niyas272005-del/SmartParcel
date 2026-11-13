@echo off
title SmartParcel System Launcher
echo ===================================================
echo     SmartParcel - Apartment Parcel Hub
echo ===================================================
echo.

REM 1. Check if MySQL is running on port 3306
echo [1/3] Verifying MySQL Database Server...
netstat -ano | findstr 3306 >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Starting local MySQL Server...
    start "MySQL Server" /B "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --datadir="%USERPROFILE%\mysql-data" --port=3306
    timeout /t 3 /nobreak >nul
) else (
    echo MySQL is already running on port 3306.
)

REM 2. Start Spring Boot Backend in a new window
echo [2/3] Starting Spring Boot Backend API (Port 8080)...
start "SmartParcel Backend API" cmd /k "cd /d %~dp0backend && mvnw.cmd spring-boot:run"

REM 3. Start Vite Frontend in a new window
echo [3/3] Starting Vite Frontend Dev Server (Port 5173)...
start "SmartParcel Frontend UI" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ===================================================
echo   All services are launching!
echo   Opening http://localhost:5173 in browser...
echo ===================================================
timeout /t 5 /nobreak >nul
start http://localhost:5173
pause

