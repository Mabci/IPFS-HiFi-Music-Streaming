#!/bin/bash

# Script de monitoreo para VPS de Transcodificación
# Ejecutar como cron job cada 5 minutos: */5 * * * * /opt/transcoding-worker/monitor.sh

set -e

# Configuración
LOG_FILE="/var/log/transcoding-worker/monitor.log"
ALERT_EMAIL="admin@yourdomain.com"
MAX_CPU_PERCENT=80
MAX_MEMORY_PERCENT=85
MAX_DISK_PERCENT=90

# Función de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Función para enviar alertas (requiere configurar sendmail o similar)
send_alert() {
    local subject="$1"
    local message="$2"
    
    log "ALERT: $subject - $message"
    
    # Descomentar si tienes sendmail configurado
    # echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
    
    # Alternativa: webhook a Discord/Slack
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"🚨 $subject: $message\"}" \
    #   "$WEBHOOK_URL"
}

# Verificar que PM2 está ejecutándose
check_pm2() {
    if ! pgrep -f "PM2" > /dev/null; then
        send_alert "PM2 Down" "PM2 no está ejecutándose en el VPS de transcodificación"
        return 1
    fi
    
    # Verificar que el worker está activo
    if ! pm2 list | grep -q "transcoding-worker.*online"; then
        send_alert "Worker Down" "El worker de transcodificación no está online"
        
        # Intentar reiniciar automáticamente
        log "Intentando reiniciar worker..."
        pm2 restart transcoding-worker
        sleep 10
        
        if pm2 list | grep -q "transcoding-worker.*online"; then
            log "Worker reiniciado exitosamente"
        else
            send_alert "Worker Restart Failed" "No se pudo reiniciar el worker automáticamente"
        fi
        return 1
    fi
    
    return 0
}

# Verificar uso de CPU
check_cpu() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*} # Remover decimales
    
    if [ "$cpu_usage" -gt "$MAX_CPU_PERCENT" ]; then
        send_alert "High CPU Usage" "CPU al ${cpu_usage}% (límite: ${MAX_CPU_PERCENT}%)"
        return 1
    fi
    
    return 0
}

# Verificar uso de memoria
check_memory() {
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    
    if [ "$memory_usage" -gt "$MAX_MEMORY_PERCENT" ]; then
        send_alert "High Memory Usage" "Memoria al ${memory_usage}% (límite: ${MAX_MEMORY_PERCENT}%)"
        return 1
    fi
    
    return 0
}

# Verificar espacio en disco
check_disk() {
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
    
    if [ "$disk_usage" -gt "$MAX_DISK_PERCENT" ]; then
        send_alert "High Disk Usage" "Disco al ${disk_usage}% (límite: ${MAX_DISK_PERCENT}%)"
        
        # Limpiar archivos temporales automáticamente
        log "Limpiando archivos temporales..."
        find /tmp/audio-processing -type f -mtime +1 -delete 2>/dev/null || true
        find /tmp -name "*.tmp" -mtime +1 -delete 2>/dev/null || true
        
        return 1
    fi
    
    return 0
}

# Verificar conectividad Redis
check_redis() {
    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
        send_alert "Redis Connection Failed" "No se puede conectar a Redis"
        return 1
    fi
    
    return 0
}

# Verificar conectividad con backend
check_backend() {
    if ! curl -s -f -H "Authorization: Bearer $WORKER_API_KEY" "$BACKEND_API_URL/api/worker/health" > /dev/null; then
        send_alert "Backend Connection Failed" "No se puede conectar con el backend API"
        return 1
    fi
    
    return 0
}

# Verificar FFmpeg
check_ffmpeg() {
    if ! command -v ffmpeg > /dev/null; then
        send_alert "FFmpeg Missing" "FFmpeg no está disponible en el sistema"
        return 1
    fi
    
    if ! command -v ffprobe > /dev/null; then
        send_alert "FFprobe Missing" "FFprobe no está disponible en el sistema"
        return 1
    fi
    
    return 0
}

# Limpiar archivos temporales antiguos
cleanup_temp_files() {
    local cleaned=0
    
    # Limpiar archivos de más de 2 horas en directorio de trabajo
    if [ -d "/tmp/audio-processing" ]; then
        cleaned=$(find /tmp/audio-processing -type f -mmin +120 -delete -print | wc -l)
        if [ "$cleaned" -gt 0 ]; then
            log "Limpiados $cleaned archivos temporales antiguos"
        fi
    fi
    
    # Limpiar logs antiguos (más de 30 días)
    find /var/log/transcoding-worker -name "*.log" -mtime +30 -delete 2>/dev/null || true
}

# Generar reporte de estado
generate_status_report() {
    local report_file="/tmp/transcoding-status-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "=== Reporte de Estado del VPS de Transcodificación ==="
        echo "Fecha: $(date)"
        echo ""
        
        echo "=== Estado de PM2 ==="
        pm2 list
        echo ""
        
        echo "=== Uso de Recursos ==="
        echo "CPU:"
        top -bn1 | head -5
        echo ""
        echo "Memoria:"
        free -h
        echo ""
        echo "Disco:"
        df -h
        echo ""
        
        echo "=== Procesos de Audio ==="
        ps aux | grep -E "(ffmpeg|ffprobe)" | grep -v grep || echo "No hay procesos de FFmpeg activos"
        echo ""
        
        echo "=== Últimos Logs del Worker ==="
        tail -20 /var/log/transcoding-worker/combined.log 2>/dev/null || echo "No hay logs disponibles"
        
    } > "$report_file"
    
    echo "$report_file"
}

# Función principal
main() {
    log "Iniciando monitoreo del sistema..."
    
    local errors=0
    
    # Cargar variables de entorno
    if [ -f "/opt/transcoding-worker/.env" ]; then
        source /opt/transcoding-worker/.env
    fi
    
    # Ejecutar verificaciones
    check_pm2 || ((errors++))
    check_cpu || ((errors++))
    check_memory || ((errors++))
    check_disk || ((errors++))
    check_ffmpeg || ((errors++))
    
    # Verificaciones de conectividad (solo si las variables están configuradas)
    if [ -n "$REDIS_HOST" ]; then
        check_redis || ((errors++))
    fi
    
    if [ -n "$BACKEND_API_URL" ]; then
        check_backend || ((errors++))
    fi
    
    # Limpiar archivos temporales
    cleanup_temp_files
    
    # Log del resultado
    if [ "$errors" -eq 0 ]; then
        log "Monitoreo completado - Sistema OK"
    else
        log "Monitoreo completado - $errors errores detectados"
    fi
    
    # Generar reporte diario (solo a las 6 AM)
    if [ "$(date +%H:%M)" = "06:00" ]; then
        local report=$(generate_status_report)
        log "Reporte diario generado: $report"
    fi
}

# Ejecutar solo si se llama directamente
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
