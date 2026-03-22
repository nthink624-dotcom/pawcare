@echo off
chcp 65001 > nul
cd /d D:\pawcare
git add .
git diff --cached --quiet
if %errorlevel%==0 (
  echo 변경된 파일이 없습니다.
  pause
  exit /b
)
git commit -m "update"
git push origin master
pause