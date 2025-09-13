#!/bin/bash

# Script de despliegue para VPS de Transcodificación
# Ejecutar desde el directorio raíz del proyecto

set -e

# Configuración
VPS_USER="transcoding-worker"
VPS_HOST="216.238.92.78"
VPS_PATH="/opt/transcoding-worker"
BACKEND_PATH="../../backend"

echo "🚀 Desplegando worker de transcodificación al VPS..."

# Verificar que estamos en el directorio correcto
if [ ! -f "../../backend/src/workers/transcoding-worker.ts" ]; then
    echo "❌ Error: No se encuentra el archivo del worker. Ejecutar desde infra/transcoding-vps/"
    exit 1
fi

# Crear directorio temporal para el despliegue
TEMP_DIR=$(mktemp -d)
echo "📁 Creando paquete de despliegue en $TEMP_DIR"

# Copiar archivos necesarios
mkdir -p "$TEMP_DIR/src/workers"
mkdir -p "$TEMP_DIR/prisma"

# Copiar worker y dependencias
cp "$BACKEND_PATH/src/workers/transcoding-worker.ts" "$TEMP_DIR/src/workers/"
cp "$BACKEND_PATH/prisma/schema.prisma" "$TEMP_DIR/prisma/"

# Copiar archivos de configuración del VPS
cp package.json "$TEMP_DIR/"
cp tsconfig.json "$TEMP_DIR/"
cp ecosystem.config.js "$TEMP_DIR/"
cp ENV.sample "$TEMP_DIR/"

# Crear README para el VPS
cat > "$TEMP_DIR/README.md" << EOF
# Worker de Transcodificación - VPS

Este es el worker de transcodificación de audio que se ejecuta en un VPS dedicado.

## Configuración Inicial

1. Copiar ENV.sample a .env y configurar las variables
2. Ejecutar: npm run setup
3. Configurar PM2: npm run pm2:start
4. Configurar startup: pm2 startup && pm2 save

## Comandos Útiles

- \`npm run pm2:logs\` - Ver logs en tiempo real
- \`npm run pm2:restart\` - Reiniciar worker
- \`npm run pm2:monit\` - Monitor de recursos
- \`npm run health\` - Verificar salud del worker

## Estructura de Archivos

- \`src/workers/transcoding-worker.ts\` - Código principal del worker
- \`ecosystem.config.js\` - Configuración de PM2
- \`prisma/schema.prisma\` - Esquema de base de datos
EOF

# Comprimir archivos
echo "📦 Comprimiendo archivos..."
cd "$TEMP_DIR"
tar -czf transcoding-worker.tar.gz *
cd - > /dev/null

# Subir al VPS
echo "⬆️ Subiendo archivos al VPS..."
scp "$TEMP_DIR/transcoding-worker.tar.gz" "$VPS_USER@$VPS_HOST:/tmp/"

# Ejecutar comandos en el VPS
echo "🔧 Configurando en el VPS..."
ssh "$VPS_USER@$VPS_HOST" << 'EOF'
set -e

# Detener worker si está ejecutándose
pm2 stop transcoding-worker 2>/dev/null || true

# Limpiar directorio anterior
sudo rm -rf /opt/transcoding-worker/*

# Extraer nuevos archivos
cd /opt/transcoding-worker
sudo tar -xzf /tmp/transcoding-worker.tar.gz
sudo chown -R transcoding-worker:transcoding-worker /opt/transcoding-worker

# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Compilar TypeScript
npm run build

# Verificar que FFmpeg está disponible
npm run test-ffmpeg

echo "✅ Despliegue completado!"
echo "📋 Para iniciar el worker:"
echo "   npm run pm2:start"
echo "   pm2 save"
EOF

# Limpiar archivos temporales
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 Despliegue completado exitosamente!"
echo ""
echo "📋 Próximos pasos en el VPS:"
echo "1. ssh $VPS_USER@$VPS_HOST"
echo "2. cd $VPS_PATH"
echo "3. cp ENV.sample .env && nano .env"
echo "4. npm run pm2:start"
echo "5. pm2 startup && pm2 save"
echo ""
echo "🔧 Comandos de monitoreo:"
echo "- ssh $VPS_USER@$VPS_HOST 'pm2 logs transcoding-worker'"
echo "- ssh $VPS_USER@$VPS_HOST 'pm2 monit'"
