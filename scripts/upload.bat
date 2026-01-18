@echo off
REM Usage: Set GITHUB_TOKEN environment variable before running this script
REM Example: set GITHUB_TOKEN=your_token_here
if "%GITHUB_TOKEN%"=="" (
    echo Error: Please set GITHUB_TOKEN environment variable
    echo Example: set GITHUB_TOKEN=your_token_here
    pause
    exit /b 1
)
node scripts/upload-to-github.js ding0803 mp-preview . --branch main
pause
