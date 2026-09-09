@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 run_no_node.py
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python run_no_node.py
  goto :eof
)
echo Python 3 is required for the included local web server. Node.js is not required.
echo Alternatively, serve the dist folder with any static HTTP server.
pause
exit /b 1
