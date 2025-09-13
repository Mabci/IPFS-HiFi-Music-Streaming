@echo off
echo Deteniendo procesos Node.js...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Eliminando cache de Prisma...
rmdir /s /q node_modules\.prisma 2>nul

echo Regenerando cliente Prisma...
npx prisma generate

echo Listo! Ahora puedes ejecutar npm run dev
pause
