FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache \
    dumb-init \
    && mkdir -p /app/logs

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --only=production && npm cache clean --force

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar código fuente
COPY src/ ./src/

# Cambiar ownership de archivos
RUN chown -R nodejs:nodejs /app

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 3001

# Usar dumb-init para manejo correcto de señales
ENTRYPOINT ["dumb-init", "--"]

# Comando por defecto
CMD ["node", "src/index.js"]
