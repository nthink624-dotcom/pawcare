@echo off
cd /d D:\pawcare

git add .
if errorlevel 1 goto fail

git diff --cached --quiet
if %errorlevel%==0 (
  echo No changes to upload.
  pause
  exit /b 0
)

git commit -m "update"
if errorlevel 1 goto fail

git push origin master
if errorlevel 1 goto fail

echo Upload complete.
pause
exit /b 0

:fail
echo Upload failed.
pause
exit /b 1
