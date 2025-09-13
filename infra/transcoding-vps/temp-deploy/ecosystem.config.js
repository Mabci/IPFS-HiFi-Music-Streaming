module.exports = {
  apps: [{
    name: 'transcoding-worker',
    script: './dist/workers/transcoding-worker-simple.js',
    cwd: '/opt/transcoding-worker',
    instances: 1,
    exec_mode: 'fork',
    
    // Configuración de recursos
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=2048',
    
    // Configuración de logs
    log_file: '/var/log/transcoding-worker/combined.log',
    out_file: '/var/log/transcoding-worker/out.log',
    error_file: '/var/log/transcoding-worker/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Configuración de reinicio
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    
    // Configuración de monitoreo
    pmx: true,
    
    // Configuración de cluster (si se necesita más concurrencia)
    // instances: 'max',
    // exec_mode: 'cluster',
    
    // Configuración de cron para reinicio diario (opcional)
    cron_restart: '0 4 * * *', // Reiniciar a las 4 AM todos los días
    
    // Configuración de señales
    kill_timeout: 30000,
    listen_timeout: 10000,
    
    // Configuración de health check
    health_check_grace_period: 30000,
    
    // Script de pre-start (opcional)
    // pre_start: './scripts/pre-start.sh',
    
    // Script de post-start (opcional)  
    // post_start: './scripts/post-start.sh'
  }],
  
  // Configuración de deploy (opcional)
  deploy: {
    production: {
      user: 'transcoding-worker',
      host: ['your-vps-ip'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/opt/transcoding-worker',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    }
  }
};
