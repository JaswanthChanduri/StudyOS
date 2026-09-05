@echo off
title StudyOS - Personal Learning OS

:: Get the folder where this bat file lives
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Opening download page...
    start https://nodejs.org
    echo Please install Node.js LTS, then run StudyOS.vbs again.
    pause
    exit /b 1
)

:: Auto-create .env if missing
if not exist "%BACKEND%\.env" (
    echo DATABASE_URL="file:./prisma/studyos.db" > "%BACKEND%\.env"
    echo PORT=3000 >> "%BACKEND%\.env"
    echo JWT_SECRET=studyos-%RANDOM%%RANDOM%-secret >> "%BACKEND%\.env"
)

:: First time setup
if not exist "%BACKEND%\node_modules" (
    cd /d "%BACKEND%"
    call npm install --silent 2>nul
    call npx prisma generate 2>nul
    call npx prisma db push --accept-data-loss 2>nul
) else (
    cd /d "%BACKEND%"
    call npx prisma db push --accept-data-loss 2>nul
)

:: Kill any existing node on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1

:: Start server hidden
cd /d "%BACKEND%"
start /min "StudyOS-Server" node src/server.js

:: Wait for server (max 15 seconds)
set COUNT=0
:WAIT
timeout /t 1 /nobreak >nul
set /a COUNT+=1
curl -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% equ 0 goto READY
if %COUNT% lss 15 goto WAIT

:READY
start "" "http://localhost:3000/desktop"
exit /b 0
