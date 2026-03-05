@echo off
chcp 65001 >nul
cd /d "%~dp0"

git add .
git commit -m "Initial commit: dingdong expense web app"
git branch -M main 2>nul
git push -u origin main

pause
