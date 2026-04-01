@echo off
title ByIbos Code Launcher

echo ====================================================
echo STARTING BYIBOS CODE WITH LOCAL LM STUDIO...
echo ====================================================
echo(

echo [1/3] Checking for LM Studio API Server in the background...
:: Try to start the API via "lms" CLI command if available.
:: Otherwise, continue silently and prompt the user to spin it up manually.
start "LM Studio Local Server" cmd /c "lms server start || echo [WARNING] 'lms' terminal command is not recognized. Please open LM Studio manually and click 'Start Local Server'! && timeout /t 10"

echo [2/3] Broadcasting Local Streaming Proxy on port 8082...
start "ByIbos Local Proxy" cmd /c "node local_proxy.js"

:: Short delay for servers to boot up safely
timeout /t 3 /nobreak >nul

echo [3/3] Loading ByIbos Agent Interface... Please wait.
echo(

:: Setting pseudo API keys to bypass Auth blocks locally
set ANTHROPIC_API_KEY=byibos-local
set ANTHROPIC_BASE_URL=http://localhost:8082

:: Notify the user if the patched node executable doesn't exist yet:
if not exist "byibos_cli.js" (
    echo [ERROR] byibos_cli.js not found! Please run "node patch_cli.js" first.
    pause
    exit /b
)

:: Run the core agent
node byibos_cli.js
