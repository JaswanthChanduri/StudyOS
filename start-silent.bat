@echo off
cd /d "%~dp0backend"
npm install --silent >nul 2>&1
node src/server.js >"%~dp0studyos.log" 2>&1
