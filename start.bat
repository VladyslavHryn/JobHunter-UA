@echo off
echo =======================================================
echo          Starting JobHunter UA
echo =======================================================
echo.

REM Start servers in a new window so this script is not blocked
start "JobHunter Servers" cmd /c "npm run dev"

echo Servers are starting... Waiting 4 seconds before opening browser.
timeout /t 4 /nobreak > nul

REM Open the site in the default browser
start http://localhost:5173/

echo.
echo Done! Site opened in your browser.
echo You can minimize the JobHunter Servers window.
echo Close that window to stop the servers.
echo.
pause
