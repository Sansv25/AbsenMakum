@echo off
title Login Instagram Mitra Iconnet
echo ========================================================
echo Membuka Chrome untuk Login Instagram Mitra Iconnet...
echo ========================================================
echo.
echo 1. Silakan login ke akun Instagram di jendela Chrome yang terbuka.
echo 2. Setelah berhasil masuk ke beranda/DM, silakan tutup jendela Chrome.
echo 3. Sesi login akan tersimpan permanen di folder profil ini.
echo.
if exist "D:\otomasi\Auto tiket\.chrome_instagram_profile" (
    "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\otomasi\Auto tiket\.chrome_instagram_profile" --no-first-run --no-default-browser-check --new-window "https://www.instagram.com/accounts/login/"
) else (
    "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%~dp0..\.chrome_instagram_profile" --no-first-run --no-default-browser-check --new-window "https://www.instagram.com/accounts/login/"
)
echo.
echo Selesai! Sesi login Anda telah tersimpan.
pause
