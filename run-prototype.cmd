@echo off
cd /d D:\pawcare
call npm.cmd run server:down
call npm.cmd run dev:local
