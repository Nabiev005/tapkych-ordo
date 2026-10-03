@echo off
chcp 65001 >nul
title Тапкыч ордо
cd /d "%~dp0"

echo.
echo   ===========================================
echo            ТАПКЫЧ ОРДО — оюнду иштетүү
echo   ===========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js орнотулган эмес.
  echo       https://nodejs.org сайтынан "LTS" версиясын жүктөп, орнотуңуз,
  echo       андан кийин бул файлды кайра эки жолу басыңыз.
  echo.
  pause
  exit /b 1
)

if not exist "server\.env" copy "server\.env.example" "server\.env" >nul

if not exist "server\node_modules" (
  echo   Биринчи жолу иштетүү: керектүү файлдар орнотулууда.
  echo   Бул интернет аркылуу бир нече мүнөткө созулушу мүмкүн...
  echo.
  call npm run setup
  if errorlevel 1 (
    echo.
    echo   [!] Орнотууда ката кетти. Интернетти текшерип, кайра аракет кылыңыз.
    pause
    exit /b 1
  )
)

if not exist "client\dist\index.html" call npm run build

echo.
echo   Сервер иштетилүүдө... Браузер бир нече секунддан кийин ачылат.
echo   Оюн бүткүчө бул терезени ЖАППАҢЫЗ!
echo.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000/admin"
call npm start
pause
