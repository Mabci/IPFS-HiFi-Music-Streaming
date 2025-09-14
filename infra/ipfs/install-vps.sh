#!/bin/bash

# =============================================================================
# Script de Instalación Automática - IPFS Gateway Privada
# =============================================================================
# Este script instala y configura completamente la IPFS Gateway privada en VPS
# Uso: curl -sSL https://raw.githubusercontent.com/tu-repo/main/infra/ipfs/install-vps.sh | bash
# O: wget -O - https://raw.githubusercontent.com/tu-repo/main/infra/ipfs/install-vps.sh | bash

set -e  # Salir si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Variables de configuración
INSTALL_DIR="/opt/ipfs-music-gateway"
SERVICE_USER="musicgateway"
REPO_URL="https://github.com/tu-usuario/tu-repo.git"  # Cambiar por tu repo
BRANCH="main"

# Función para verificar si se ejecuta como root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script debe ejecutarse como root (sudo)"
        exit 1
    fi
}

# Función para detectar el sistema operativo
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_error "No se puede detectar el sistema operativo"
        exit 1
    fi
    
    log_info "Sistema detectado: $OS $VER"
}

# Función para actualizar el sistema
update_system() {
    log_info "Actualizando sistema..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt update && apt upgrade -y
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        yum update -y
    else
        log_warning "Sistema no reconocido, intentando con apt..."
        apt update && apt upgrade -y
    fi
    
    log_success "Sistema actualizado"
}

# Función para instalar dependencias
install_dependencies() {
    log_info "Instalando dependencias..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt install -y \
            curl \
            wget \
            git \
            ufw \
            htop \
            nano \
            unzip \
            software-properties-common \
            apt-transport-https \
            ca-certificates \
            gnupg \
            lsb-release
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        yum install -y curl wget git firewalld htop nano unzip
    fi
    
    log_success "Dependencias instaladas"
}

# Función para instalar Docker
install_docker() {
    log_info "Instalando Docker..."
    
    # Remover versiones antiguas
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Agregar repositorio oficial de Docker
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Instalar Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Habilitar Docker
    systemctl enable docker
    systemctl start docker
    
    # Verificar instalación
    docker --version
    docker compose version
    
    log_success "Docker instalado correctamente"
}

# Función para configurar firewall
configure_firewall() {
    log_info "Configurando firewall..."
    
    # Habilitar UFW
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    
    # Permitir SSH
    ufw allow ssh
    ufw allow 22/tcp
    
    # Permitir puertos de la aplicación
    ufw allow 3001/tcp comment "IPFS Gateway Proxy"
    ufw allow 4001/tcp comment "IPFS Swarm"
    ufw allow 4001/udp comment "IPFS Swarm UDP"
    
    # Permitir HTTP/HTTPS si se va a usar nginx
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    
    # Habilitar firewall
    ufw --force enable
    
    log_success "Firewall configurado"
}

# Función para crear usuario de servicio
create_service_user() {
    log_info "Creando usuario de servicio..."
    
    # Crear usuario si no existe
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -m -s /bin/bash "$SERVICE_USER"
        usermod -aG docker "$SERVICE_USER"
        log_success "Usuario $SERVICE_USER creado"
    else
        log_info "Usuario $SERVICE_USER ya existe"
        usermod -aG docker "$SERVICE_USER"
    fi
    
    # Crear directorio de instalación
    mkdir -p "$INSTALL_DIR"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
}

# Función para clonar el repositorio
clone_repository() {
    log_info "Clonando repositorio..."
    
    # Cambiar al usuario de servicio para clonar
    sudo -u "$SERVICE_USER" bash << EOF
cd "$INSTALL_DIR"
if [[ -d ".git" ]]; then
    log_info "Repositorio ya existe, actualizando..."
    git pull origin $BRANCH
else
    git clone -b $BRANCH "$REPO_URL" .
fi
EOF
    
    log_success "Repositorio clonado/actualizado"
}

# Función para configurar variables de entorno
configure_environment() {
    log_info "Configurando variables de entorno..."
    
    # Crear archivo .env desde template
    sudo -u "$SERVICE_USER" bash << 'EOF'
cd "$INSTALL_DIR/infra/ipfs"

# Copiar template
cp gateway-proxy/env.example gateway-proxy/.env

# Generar contraseñas seguras
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Configurar variables básicas
cat > gateway-proxy/.env << EOL
# Server Configuration
PORT=3001
NODE_ENV=production

# IPFS Configuration
IPFS_API_URL=http://ipfs-node:5001
IPFS_GATEWAY_URL=http://ipfs-node:8080

# Cache Configuration
REDIS_URL=redis://redis:6379
CACHE_TTL=3600
MAX_CACHE_SIZE=1GB

# Database Configuration (Gateway metrics)
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/music_gateway

# IMPORTANTE: Configurar manualmente después de la instalación
MAIN_DATABASE_URL=postgresql://user:password@your-backend-host:5432/your_main_db

# Logging
LOG_LEVEL=info
EOL

# Actualizar docker-compose con la contraseña generada
sed -i "s/POSTGRES_PASSWORD=password/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" docker-compose.yml
sed -i "s/password@postgres/${POSTGRES_PASSWORD}@postgres/" gateway-proxy/.env

echo "Contraseña de PostgreSQL generada: ${POSTGRES_PASSWORD}"
echo "Guarda esta contraseña en un lugar seguro"
EOF
    
    log_success "Variables de entorno configuradas"
}

# Función para crear directorios necesarios
create_directories() {
    log_info "Creando directorios necesarios..."
    
    sudo -u "$SERVICE_USER" bash << EOF
cd "$INSTALL_DIR/infra/ipfs"

# Crear directorios de datos
mkdir -p data/ipfs
mkdir -p data/redis
mkdir -p data/postgres
mkdir -p data/prometheus
mkdir -p logs

# Crear directorio de logs para gateway
mkdir -p gateway-proxy/logs

# Permisos correctos
chmod 755 data/
chmod 755 logs/
EOF
    
    log_success "Directorios creados"
}

# Función para construir e iniciar servicios
start_services() {
    log_info "Construyendo e iniciando servicios..."
    
    sudo -u "$SERVICE_USER" bash << EOF
cd "$INSTALL_DIR/infra/ipfs"

# Construir imágenes
docker compose build

# Iniciar servicios
docker compose up -d

# Esperar a que los servicios estén listos
echo "Esperando a que los servicios inicien..."
sleep 30

# Verificar estado
docker compose ps
EOF
    
    log_success "Servicios iniciados"
}

# Función para configurar systemd service
create_systemd_service() {
    log_info "Creando servicio systemd..."
    
    cat > /etc/systemd/system/ipfs-music-gateway.service << EOF
[Unit]
Description=IPFS Music Gateway Private
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR/infra/ipfs
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=$SERVICE_USER
Group=$SERVICE_USER

[Install]
WantedBy=multi-user.target
EOF
    
    # Habilitar servicio
    systemctl daemon-reload
    systemctl enable ipfs-music-gateway.service
    
    log_success "Servicio systemd creado y habilitado"
}

# Función para verificar instalación
verify_installation() {
    log_info "Verificando instalación..."
    
    # Verificar servicios Docker
    if sudo -u "$SERVICE_USER" docker compose -f "$INSTALL_DIR/infra/ipfs/docker-compose.yml" ps | grep -q "Up"; then
        log_success "Servicios Docker ejecutándose correctamente"
    else
        log_error "Algunos servicios Docker no están ejecutándose"
        return 1
    fi
    
    # Verificar endpoint de salud
    sleep 10
    if curl -s http://localhost:3001/health | grep -q "ok"; then
        log_success "Gateway respondiendo correctamente"
    else
        log_warning "Gateway no responde aún, puede necesitar más tiempo"
    fi
    
    # Mostrar información de conexión
    echo ""
    log_info "=== INFORMACIÓN DE CONEXIÓN ==="
    echo "Gateway URL: http://$(curl -s ifconfig.me):3001"
    echo "Health Check: http://$(curl -s ifconfig.me):3001/health"
    echo "Metrics: http://$(curl -s ifconfig.me):3001/metrics"
    echo ""
    echo "Archivos de configuración:"
    echo "- Variables de entorno: $INSTALL_DIR/infra/ipfs/gateway-proxy/.env"
    echo "- Docker Compose: $INSTALL_DIR/infra/ipfs/docker-compose.yml"
    echo ""
    echo "Comandos útiles:"
    echo "- Ver logs: cd $INSTALL_DIR/infra/ipfs && docker compose logs -f"
    echo "- Reiniciar: sudo systemctl restart ipfs-music-gateway"
    echo "- Estado: sudo systemctl status ipfs-music-gateway"
}

# Función para mostrar configuración pendiente
show_pending_config() {
    log_warning "=== CONFIGURACIÓN PENDIENTE ==="
    echo ""
    echo "1. Editar variables de entorno:"
    echo "   nano $INSTALL_DIR/infra/ipfs/gateway-proxy/.env"
    echo ""
    echo "2. Configurar MAIN_DATABASE_URL con tu base de datos principal:"
    echo "   MAIN_DATABASE_URL=postgresql://user:password@tu-backend-host:5432/tu_bd"
    echo ""
    echo "3. Reiniciar servicios después de la configuración:"
    echo "   cd $INSTALL_DIR/infra/ipfs && docker compose restart"
    echo ""
    echo "4. Sincronizar pins iniciales:"
    echo "   curl -X POST http://localhost:3001/admin/sync-pins"
    echo ""
}

# Función principal
main() {
    echo "=============================================="
    echo "  IPFS Music Gateway - Instalación Automática"
    echo "=============================================="
    echo ""
    
    check_root
    detect_os
    update_system
    install_dependencies
    install_docker
    configure_firewall
    create_service_user
    
    # Si no se proporciona repo, usar archivos locales
    if [[ -z "$REPO_URL" ]] || [[ "$REPO_URL" == "https://github.com/tu-usuario/tu-repo.git" ]]; then
        log_warning "URL del repositorio no configurada, usando archivos locales"
        log_info "Asegúrate de copiar los archivos manualmente a $INSTALL_DIR"
    else
        clone_repository
    fi
    
    configure_environment
    create_directories
    start_services
    create_systemd_service
    verify_installation
    show_pending_config
    
    echo ""
    log_success "¡Instalación completada!"
    echo ""
    echo "La IPFS Gateway privada está ejecutándose en el puerto 3001"
    echo "Recuerda configurar MAIN_DATABASE_URL y reiniciar los servicios"
}

# Ejecutar instalación
main "$@"
