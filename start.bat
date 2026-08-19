@echo off
REM Bug Tracker - one-step local start (Windows).
REM Installs dependencies if needed, applies database migrations, builds,
REM starts the app on 127.0.0.1 and opens your browser.
setlocal
cd /d "%~dp0"

if "%PORT%"=="" set PORT=3000

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo No .env file found - created one from .env.example.
  echo Open it, fill in DATABASE_URL, AUTH_PASSWORD and SESSION_SECRET, then run this again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies ^(first run only^)...
  call npm install || goto :fail
)

if not exist "mcp-server\node_modules" (
  echo Installing MCP server dependencies...
  pushd mcp-server
  call npm install || goto :fail
  popd
)

echo Applying database migrations...
call node migrate.mjs || goto :fail

echo Building...
call npm run build || goto :fail

echo Starting on http://127.0.0.1:%PORT% ^(localhost only^)...
REM Open the browser a few seconds later, once the server is listening.
start "" cmd /c "timeout /t 6 /nobreak >nul & start "" http://localhost:%PORT%"
call npm start
goto :eof

:fail
echo.
echo Startup failed - see the messages above.
pause
exit /b 1
