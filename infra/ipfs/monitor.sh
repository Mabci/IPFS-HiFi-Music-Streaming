#!/bin/bash

# =============================================================================
# Script de Monitoreo - IPFS Gateway Privada
# =============================================================================
# Este script proporciona comandos útiles para monitorear la gateway

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

# Función para mostrar estado general
show_status() {
    echo "=============================================="
    echo "  Estado de IPFS Gateway Privada"
    echo "=============================================="
    echo ""
    
    # Estado del servicio systemd
    log_info "Estado del servicio:"
    systemctl status ipfs-music-gateway --no-pager -l
    echo ""
    
    # Estado de contenedores Docker
    log_info "Estado de contenedores:"
    cd "$INSTALL_DIR/infra/ipfs"
    docker compose ps
    echo ""
    
    # Verificar conectividad
    log_info "Verificando conectividad:"
    if curl -s http://localhost:3001/health | jq . 2>/dev/null; then
        log_success "Gateway respondiendo correctamente"
    else
        log_error "Gateway no responde"
    fi
    echo ""
    
    # Uso de recursos
    log_info "Uso de recursos:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Función para mostrar logs
show_logs() {
    local service="$1"
    cd "$INSTALL_DIR/infra/ipfs"
    
    case "$service" in
        "gateway"|"proxy")
            log_info "Logs del Gateway Proxy:"
            docker compose logs -f --tail=50 gateway-proxy
            ;;
        "ipfs"|"node")
            log_info "Logs del nodo IPFS:"
            docker compose logs -f --tail=50 ipfs-node
            ;;
        "redis")
            log_info "Logs de Redis:"
            docker compose logs -f --tail=50 redis
            ;;
        "postgres"|"db")
            log_info "Logs de PostgreSQL:"
            docker compose logs -f --tail=50 postgres
            ;;
        "all"|"")
            log_info "Logs de todos los servicios:"
            docker compose logs -f --tail=20
            ;;
        *)
            log_error "Servicio no reconocido: $service"
            echo "Servicios disponibles: gateway, ipfs, redis, postgres, all"
            ;;
    esac
}

# Función para mostrar métricas
show_metrics() {
    echo "=============================================="
    echo "  Métricas de la Gateway"
    echo "=============================================="
    echo ""
    
    if curl -s http://localhost:3001/metrics > /tmp/metrics.txt; then
        log_info "Requests totales:"
        grep "http_requests_total" /tmp/metrics.txt | grep -v "#"
        echo ""
        
        log_info "Cache hits/misses:"
        grep "cache_hits_total" /tmp/metrics.txt | grep -v "#"
        echo ""
        
        log_info "Requests IPFS:"
        grep "ipfs_requests_total" /tmp/metrics.txt | grep -v "#"
        echo ""
        
        log_info "Pins activos:"
        grep "ipfs_active_pins_total" /tmp/metrics.txt | grep -v "#"
        echo ""
        
        log_info "Requests no autorizados:"
        grep "unauthorized_requests_total" /tmp/metrics.txt | grep -v "#"
        echo ""
        
        rm -f /tmp/metrics.txt
    else
        log_error "No se pudieron obtener las métricas"
    fi
}

# Función para verificar IPFS
check_ipfs() {
    echo "=============================================="
    echo "  Estado del Nodo IPFS"
    echo "=============================================="
    echo ""
    
    cd "$INSTALL_DIR/infra/ipfs"
    
    log_info "Información del nodo:"
    docker compose exec ipfs-node ipfs id
    echo ""
    
    log_info "Peers conectados:"
    peer_count=$(docker compose exec ipfs-node ipfs swarm peers | wc -l)
    echo "Conectado a $peer_count peers"
    echo ""
    
    log_info "Contenido pinneado:"
    pin_count=$(docker compose exec ipfs-node ipfs pin ls --type=recursive | wc -l)
    echo "Total de pins: $pin_count"
    echo ""
    
    log_info "Uso del repositorio:"
    docker compose exec ipfs-node ipfs repo stat
}

# Función para sincronizar pins
sync_pins() {
    log_info "Sincronizando pins con la base de datos principal..."
    
    response=$(curl -s -X POST http://localhost:3001/admin/sync-pins)
    
    if echo "$response" | grep -q "success"; then
        log_success "Sincronización completada"
        echo "$response" | jq .
    else
        log_error "Error en la sincronización"
        echo "$response"
    fi
}

# Función para hacer backup
backup_data() {
    local backup_dir="/opt/backups/ipfs-gateway"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    log_info "Creando backup..."
    
    # Crear directorio de backup
    mkdir -p "$backup_dir"
    
    cd "$INSTALL_DIR/infra/ipfs"
    
    # Backup de datos IPFS
    log_info "Backup de datos IPFS..."
    tar -czf "$backup_dir/ipfs-data-$timestamp.tar.gz" data/ipfs/
    
    # Backup de base de datos
    log_info "Backup de base de datos..."
    docker compose exec postgres pg_dump -U postgres music_gateway > "$backup_dir/postgres-$timestamp.sql"
    
    # Backup de configuración
    log_info "Backup de configuración..."
    cp gateway-proxy/.env "$backup_dir/env-$timestamp.backup"
    cp docker-compose.yml "$backup_dir/docker-compose-$timestamp.yml"
    
    log_success "Backup completado en $backup_dir/"
    ls -la "$backup_dir/"
}

# Función para reiniciar servicios
restart_services() {
    local service="$1"
    cd "$INSTALL_DIR/infra/ipfs"
    
    case "$service" in
        "gateway"|"proxy")
            log_info "Reiniciando Gateway Proxy..."
            docker compose restart gateway-proxy
            ;;
        "ipfs"|"node")
            log_info "Reiniciando nodo IPFS..."
            docker compose restart ipfs-node
            ;;
        "redis")
            log_info "Reiniciando Redis..."
            docker compose restart redis
            ;;
        "postgres"|"db")
            log_info "Reiniciando PostgreSQL..."
            docker compose restart postgres
            ;;
        "all"|"")
            log_info "Reiniciando todos los servicios..."
            docker compose restart
            ;;
        *)
            log_error "Servicio no reconocido: $service"
            echo "Servicios disponibles: gateway, ipfs, redis, postgres, all"
            return 1
            ;;
    esac
    
    log_success "Servicio(s) reiniciado(s)"
}

# Función para mostrar ayuda
show_help() {
    echo "=============================================="
    echo "  Monitor IPFS Gateway Privada"
    echo "=============================================="
    echo ""
    echo "Uso: $0 [comando] [opciones]"
    echo ""
    echo "Comandos disponibles:"
    echo "  status                 - Mostrar estado general"
    echo "  logs [servicio]        - Mostrar logs (gateway|ipfs|redis|postgres|all)"
    echo "  metrics               - Mostrar métricas de la gateway"
    echo "  ipfs                  - Verificar estado del nodo IPFS"
    echo "  sync                  - Sincronizar pins con BD principal"
    echo "  backup                - Crear backup de datos"
    echo "  restart [servicio]    - Reiniciar servicios"
    echo "  help                  - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 status"
    echo "  $0 logs gateway"
    echo "  $0 restart all"
    echo ""
}

# Función principal
main() {
    local command="$1"
    local option="$2"
    
    case "$command" in
        "status")
            show_status
            ;;
        "logs")
            show_logs "$option"
            ;;
        "metrics")
            show_metrics
            ;;
        "ipfs")
            check_ipfs
            ;;
        "sync")
            sync_pins
            ;;
        "backup")
            backup_data
            ;;
        "restart")
            restart_services "$option"
            ;;
        "help"|"--help"|"-h"|"")
            show_help
            ;;
        *)
            log_error "Comando no reconocido: $command"
            show_help
            exit 1
            ;;
    esac
}

# Verificar que jq esté instalado para formatear JSON
if ! command -v jq &> /dev/null; then
    log_warning "jq no está instalado, instalando..."
    apt update && apt install -y jq
fi

# Ejecutar comando
main "$@"
