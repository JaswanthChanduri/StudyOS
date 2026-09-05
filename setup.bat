@echo off
echo.
echo  =============================================
echo   StudyOS v2.0 — First Time Setup (Windows)
echo  =============================================
echo.

cd /d "%~dp0backend"

echo [1/4] Installing backend dependencies...
call npm install
if %errorlevel% neq 0 ( echo ERROR: npm install failed & pause & exit /b 1 )

echo.
echo [2/4] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 ( echo ERROR: prisma generate failed & pause & exit /b 1 )

echo.
echo [3/4] Creating database...
call npx prisma migrate dev --name init
if %errorlevel% neq 0 (
  echo Trying db push instead...
  call npx prisma db push
  if %errorlevel% neq 0 ( echo ERROR: database setup failed & pause & exit /b 1 )
)

echo.
echo [4/4] Creating desktop shortcut...
cd /d "%~dp0"
set SCRIPT="%TEMP%\CreateShortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\StudyOS.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%~dp0Start-StudyOS.vbs" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "StudyOS Personal Learning OS" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%
cscript //nologo %SCRIPT%
del %SCRIPT%

echo.
echo  =============================================
echo   Setup complete!
echo.
echo   A "StudyOS" shortcut was added to Desktop.
echo   Double-click it to launch — no CMD needed!
echo  =============================================
echo.
pause
