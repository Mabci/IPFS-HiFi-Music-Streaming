#!/bin/bash

# Script de configuración para VPS de Transcodificación
# Ubuntu 22.04 LTS recomendado

set -e

echo "🚀 Configurando VPS de Transcodificación..."

# Actualizar sistema
echo "📦 Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar dependencias del sistema
echo "🔧 Instalando dependencias del sistema..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    htop \
    unzip

# Instalar Node.js 20.x
echo "📦 Instalando Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación de Node.js
node --version
npm --version

# Instalar FFmpeg con soporte completo
echo "🎵 Instalando FFmpeg..."
sudo apt install -y ffmpeg

# Verificar FFmpeg
ffmpeg -version
ffprobe -version

# Instalar PM2 para gestión de procesos
echo "⚙️ Instalando PM2..."
sudo npm install -g pm2

# Crear usuario para el worker
echo "👤 Creando usuario transcoding-worker..."
sudo useradd -m -s /bin/bash transcoding-worker
sudo usermod -aG sudo transcoding-worker

# Crear directorios de trabajo
echo "📁 Creando directorios de trabajo..."
sudo mkdir -p /opt/transcoding-worker
sudo mkdir -p /tmp/audio-processing
sudo mkdir -p /var/log/transcoding-worker

# Configurar permisos
sudo chown -R transcoding-worker:transcoding-worker /opt/transcoding-worker
sudo chown -R transcoding-worker:transcoding-worker /tmp/audio-processing
sudo chown -R transcoding-worker:transcoding-worker /var/log/transcoding-worker

# Configurar límites del sistema para procesamiento de audio
echo "⚡ Configurando límites del sistema..."
sudo tee -a /etc/security/limits.conf << EOF
transcoding-worker soft nofile 65536
transcoding-worker hard nofile 65536
transcoding-worker soft nproc 32768
transcoding-worker hard nproc 32768
EOF

# Configurar logrotate para logs del worker
echo "📝 Configurando rotación de logs..."
sudo tee /etc/logrotate.d/transcoding-worker << EOF
/var/log/transcoding-worker/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 transcoding-worker transcoding-worker
    postrotate
        pm2 reload transcoding-worker
    endscript
}
EOF

# Instalar IPFS (opcional, para nodo local)
echo "🌐 Instalando IPFS..."
wget https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_linux-amd64.tar.gz
tar -xzf kubo_v0.24.0_linux-amd64.tar.gz
sudo mv kubo/ipfs /usr/local/bin/
rm -rf kubo kubo_v0.24.0_linux-amd64.tar.gz

# Inicializar IPFS para el usuario transcoding-worker
sudo -u transcoding-worker ipfs init

# Configurar firewall básico
echo "🔒 Configurando firewall..."
sudo ufw allow ssh
sudo ufw allow 22
sudo ufw --force enable

# Configurar swap si no existe (recomendado para procesamiento de audio)
if [ ! -f /swapfile ]; then
    echo "💾 Configurando swap de 4GB..."
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# Optimizaciones del kernel para procesamiento de audio
echo "🔧 Aplicando optimizaciones del kernel..."
sudo tee -a /etc/sysctl.conf << EOF
# Optimizaciones para procesamiento de audio
vm.swappiness=10
vm.dirty_ratio=15
vm.dirty_background_ratio=5
kernel.sched_rt_runtime_us=-1
EOF

sudo sysctl -p

echo "✅ Configuración base del VPS completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Copiar el código del worker a /opt/transcoding-worker/"
echo "2. Configurar el archivo .env con las credenciales"
echo "3. Instalar dependencias: npm install"
echo "4. Configurar PM2: pm2 start ecosystem.config.js"
echo "5. Configurar PM2 startup: pm2 startup && pm2 save"
echo ""
echo "🔧 Comandos útiles:"
echo "- Ver logs: pm2 logs transcoding-worker"
echo "- Reiniciar worker: pm2 restart transcoding-worker"
echo "- Estado del worker: pm2 status"
echo "- Monitoreo: pm2 monit"
