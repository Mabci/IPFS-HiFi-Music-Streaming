FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache \
    dumb-init 

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --only=production

# Copiar código fuente
COPY src/ ./src/

# Crear directorio de logs
RUN mkdir -p logs

# Usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Exponer puerto
EXPOSE 3001

# Usar dumb-init para manejo correcto de señales
ENTRYPOINT ["dumb-init", "--"]

# Comando por defecto - versión privada
CMD ["node", "src/index-private.js"]
