#!/bin/bash

# =============================================================================
# Script de Configuración de Variables de Entorno
# =============================================================================
# Este script ayuda a configurar las variables de entorno después de la instalación

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

INSTALL_DIR="/opt/ipfs-music-gateway"
ENV_FILE="$INSTALL_DIR/infra/ipfs/gateway-proxy/.env"

# Función para validar URL de base de datos
validate_db_url() {
    local url="$1"
    if [[ $url =~ ^postgresql://[^:]+:[^@]+@[^:]+:[0-9]+/[^/]+$ ]]; then
        return 0
    else
        return 1
    fi
}

# Función para configurar base de datos principal
configure_main_database() {
    echo ""
    log_info "=== CONFIGURACIÓN DE BASE DE DATOS PRINCIPAL ==="
    echo ""
    echo "Necesitas configurar la conexión a tu base de datos principal"
    echo "donde están almacenados los CIDs autorizados de tu plataforma."
    echo ""
    
    while true; do
        echo "Opciones disponibles:"
        echo "1) Base de datos en Render"
        echo "2) Base de datos en Railway"
        echo "3) Base de datos en el mismo VPS"
        echo "4) Otra URL personalizada"
        echo ""
        read -p "Selecciona una opción (1-4): " option
        
        case $option in
            1)
                echo ""
                log_info "Configuración para Render:"
                echo "Formato: postgresql://user:password@host.render.com:5432/database"
                echo ""
                read -p "Usuario de BD: " db_user
                read -s -p "Contraseña de BD: " db_password
                echo ""
                read -p "Host de Render (ej: dpg-xxxxx-a.oregon-postgres.render.com): " db_host
                read -p "Nombre de la base de datos: " db_name
                
                MAIN_DB_URL="postgresql://${db_user}:${db_password}@${db_host}:5432/${db_name}"
                break
                ;;
            2)
                echo ""
                log_info "Configuración para Railway:"
                echo "Formato: postgresql://user:password@host.railway.app:5432/railway"
                echo ""
                read -p "Usuario de BD: " db_user
                read -s -p "Contraseña de BD: " db_password
                echo ""
                read -p "Host de Railway (ej: containers-us-west-xxx.railway.app): " db_host
                read -p "Nombre de la base de datos: " db_name
                
                MAIN_DB_URL="postgresql://${db_user}:${db_password}@${db_host}:5432/${db_name}"
                break
                ;;
            3)
                echo ""
                log_info "Configuración para BD local en VPS:"
                read -p "Usuario de BD: " db_user
                read -s -p "Contraseña de BD: " db_password
                echo ""
                read -p "Nombre de la base de datos: " db_name
                
                MAIN_DB_URL="postgresql://${db_user}:${db_password}@localhost:5432/${db_name}"
                break
                ;;
            4)
                echo ""
                log_info "URL personalizada:"
                echo "Formato: postgresql://user:password@host:port/database"
                read -p "URL completa: " MAIN_DB_URL
                break
                ;;
            *)
                log_error "Opción inválida"
                ;;
        esac
    done
    
    # Validar URL
    if validate_db_url "$MAIN_DB_URL"; then
        log_success "URL de base de datos válida"
    else
        log_warning "La URL puede tener formato incorrecto, pero continuando..."
    fi
    
    # Actualizar archivo .env
    if [[ -f "$ENV_FILE" ]]; then
        sed -i "s|MAIN_DATABASE_URL=.*|MAIN_DATABASE_URL=${MAIN_DB_URL}|" "$ENV_FILE"
        log_success "Archivo .env actualizado"
    else
        log_error "Archivo .env no encontrado en $ENV_FILE"
        exit 1
    fi
}

# Función para configurar dominio (opcional)
configure_domain() {
    echo ""
    log_info "=== CONFIGURACIÓN DE DOMINIO (OPCIONAL) ==="
    echo ""
    read -p "¿Tienes un dominio para la gateway? (y/n): " has_domain
    
    if [[ "$has_domain" == "y" || "$has_domain" == "Y" ]]; then
        read -p "Ingresa tu dominio (ej: gateway.tudominio.com): " domain
        
        log_info "Para configurar el dominio necesitarás:"
        echo "1. Apuntar el registro A de '$domain' a la IP de este VPS"
        echo "2. Instalar nginx como proxy reverso"
        echo "3. Configurar SSL con Let's Encrypt"
        echo ""
        read -p "¿Quieres instalar nginx automáticamente? (y/n): " install_nginx
        
        if [[ "$install_nginx" == "y" || "$install_nginx" == "Y" ]]; then
            install_nginx_proxy "$domain"
        fi
    fi
}

# Función para instalar nginx
install_nginx_proxy() {
    local domain="$1"
    
    log_info "Instalando nginx..."
    apt update
    apt install -y nginx certbot python3-certbot-nginx
    
    # Crear configuración de nginx
    cat > "/etc/nginx/sites-available/ipfs-gateway" << EOF
server {
    listen 80;
    server_name $domain;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Headers para IPFS
        proxy_set_header Range \$http_range;
        proxy_set_header If-Range \$http_if_range;
        
        # Timeouts para archivos grandes
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF
    
    # Habilitar sitio
    ln -sf /etc/nginx/sites-available/ipfs-gateway /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Verificar configuración
    nginx -t
    systemctl restart nginx
    systemctl enable nginx
    
    log_success "Nginx configurado"
    
    # Configurar SSL
    log_info "Configurando SSL con Let's Encrypt..."
    certbot --nginx -d "$domain" --non-interactive --agree-tos --email admin@"$domain"
    
    log_success "SSL configurado para $domain"
}

# Función para probar conexión a BD
test_database_connection() {
    echo ""
    log_info "=== PROBANDO CONEXIÓN A BASE DE DATOS ==="
    
    # Extraer componentes de la URL
    if [[ $MAIN_DB_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        db_user="${BASH_REMATCH[1]}"
        db_password="${BASH_REMATCH[2]}"
        db_host="${BASH_REMATCH[3]}"
        db_port="${BASH_REMATCH[4]}"
        db_name="${BASH_REMATCH[5]}"
        
        log_info "Probando conexión a $db_host:$db_port..."
        
        # Instalar cliente postgresql si no existe
        if ! command -v psql &> /dev/null; then
            log_info "Instalando cliente PostgreSQL..."
            apt install -y postgresql-client
        fi
        
        # Probar conexión
        if PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" &>/dev/null; then
            log_success "Conexión a base de datos exitosa"
            
            # Verificar tablas necesarias
            log_info "Verificando tablas necesarias..."
            tables=$(PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('tracks', 'albums', 'user_uploads');" | tr -d ' ')
            
            if [[ "$tables" == *"tracks"* ]]; then
                log_success "Tabla 'tracks' encontrada"
            else
                log_warning "Tabla 'tracks' no encontrada"
            fi
            
            if [[ "$tables" == *"albums"* ]]; then
                log_success "Tabla 'albums' encontrada"
            else
                log_warning "Tabla 'albums' no encontrada"
            fi
            
        else
            log_error "No se pudo conectar a la base de datos"
            log_error "Verifica las credenciales y la conectividad"
        fi
    else
        log_error "URL de base de datos con formato incorrecto"
    fi
}

# Función para reiniciar servicios
restart_services() {
    echo ""
    log_info "=== REINICIANDO SERVICIOS ==="
    
    cd "$INSTALL_DIR/infra/ipfs"
    
    log_info "Deteniendo servicios..."
    docker compose down
    
    log_info "Iniciando servicios..."
    docker compose up -d
    
    log_info "Esperando a que los servicios inicien..."
    sleep 20
    
    # Verificar estado
    if docker compose ps | grep -q "Up"; then
        log_success "Servicios reiniciados correctamente"
    else
        log_error "Algunos servicios no iniciaron correctamente"
        docker compose ps
    fi
}

# Función para sincronizar pins
sync_pins() {
    echo ""
    log_info "=== SINCRONIZACIÓN INICIAL DE PINS ==="
    
    log_info "Esperando a que la gateway esté lista..."
    sleep 10
    
    # Verificar que la gateway responda
    if curl -s http://localhost:3001/health | grep -q "ok"; then
        log_success "Gateway respondiendo"
        
        log_info "Iniciando sincronización de pins..."
        response=$(curl -s -X POST http://localhost:3001/admin/sync-pins)
        
        if echo "$response" | grep -q "success"; then
            log_success "Sincronización de pins completada"
            echo "$response"
        else
            log_warning "Sincronización de pins falló o parcial"
            echo "$response"
        fi
    else
        log_error "Gateway no responde, verifica los logs"
        echo "Comando para ver logs: cd $INSTALL_DIR/infra/ipfs && docker compose logs -f gateway-proxy"
    fi
}

# Función para mostrar información final
show_final_info() {
    echo ""
    echo "=============================================="
    log_success "CONFIGURACIÓN COMPLETADA"
    echo "=============================================="
    echo ""
    
    # Obtener IP pública
    public_ip=$(curl -s ifconfig.me 2>/dev/null || echo "IP_NO_DETECTADA")
    
    echo "🌐 URLs de acceso:"
    echo "   Gateway: http://$public_ip:3001"
    echo "   Health: http://$public_ip:3001/health"
    echo "   Metrics: http://$public_ip:3001/metrics"
    echo ""
    
    echo "📁 Archivos importantes:"
    echo "   Configuración: $ENV_FILE"
    echo "   Logs: cd $INSTALL_DIR/infra/ipfs && docker compose logs -f"
    echo ""
    
    echo "🔧 Comandos útiles:"
    echo "   Estado: systemctl status ipfs-music-gateway"
    echo "   Reiniciar: systemctl restart ipfs-music-gateway"
    echo "   Logs: cd $INSTALL_DIR/infra/ipfs && docker compose logs -f gateway-proxy"
    echo "   Sync pins: curl -X POST http://localhost:3001/admin/sync-pins"
    echo ""
    
    echo "🔒 Seguridad:"
    echo "   - Solo sirve CIDs autorizados desde tu BD"
    echo "   - Sin fallbacks a gateways públicos"
    echo "   - Rate limiting habilitado"
    echo "   - Firewall configurado"
    echo ""
}

# Función principal
main() {
    echo "=============================================="
    echo "  Configuración de Variables de Entorno"
    echo "=============================================="
    
    # Verificar que el archivo .env existe
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Archivo .env no encontrado. ¿Ejecutaste el script de instalación?"
        exit 1
    fi
    
    configure_main_database
    test_database_connection
    configure_domain
    restart_services
    sync_pins
    show_final_info
}

# Verificar si se ejecuta como root
if [[ $EUID -ne 0 ]]; then
    log_error "Este script debe ejecutarse como root (sudo)"
    exit 1
fi

# Ejecutar configuración
main "$@"
