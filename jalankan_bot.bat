@echo off
title BOT OTOMASI TIKET ICONNET - LOCAL RUNNER
color 0B
echo ========================================================
echo   MENJALANKAN BOT OTOMASI TIKET ICONNET (PUPPETEER)
echo ========================================================
echo.
echo Pastikan Anda sudah login Instagram lewat login_instagram.bat sekali saja.
echo Bot ini akan memantau antrean tiket di Supabase secara otomatis dan
echo mengetikkan laporan keluhan ke DM Instagram @iconnet.here di laptop ini.
echo.
cd /d "%~dp0app"
node "%~dp0bot\runner.mjs"
pause
