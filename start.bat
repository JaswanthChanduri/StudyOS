@echo off
echo.
echo  ==========================================
echo   StudyOS v2.0 — Starting Server
echo  ==========================================
echo.
cd /d "%~dp0backend"
echo Checking dependencies...
call npm install --silent
if %errorlevel% neq 0 ( echo ERROR: npm install failed & pause & exit /b 1 )
echo.
echo  Desktop:  http://localhost:3000/desktop
echo  Logs:     %~dp0studyos.log
echo.
echo  Keep this window open while using StudyOS.
echo  Or use Start-StudyOS.vbs for no CMD window.
echo  Press Ctrl+C to stop the server.
echo.
node src/server.js
if %errorlevel% neq 0 (
  echo.
  echo  ERROR: Server failed to start - read above
  echo.
)
pause
