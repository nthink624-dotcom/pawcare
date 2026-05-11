@echo off
cd /d D:\petmanager
call npm.cmd run server:down
call npm.cmd run dev:local
