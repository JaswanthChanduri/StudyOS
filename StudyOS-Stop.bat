@echo off
title StudyOS - Stop
echo Stopping StudyOS...
taskkill /F /FI "WINDOWTITLE eq StudyOS-Server" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo StudyOS stopped.
timeout /t 2 /nobreak >nul
