-- Inicialización de base de datos para el gateway IPFS
-- Tablas para métricas y gestión de contenido

CREATE TABLE IF NOT EXISTS pins (
    id SERIAL PRIMARY KEY,
    cid VARCHAR(255) UNIQUE NOT NULL,
    pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    is_popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gateway_metrics (
    id SERIAL PRIMARY KEY,
    cid VARCHAR(255) NOT NULL,
    request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INTEGER,
    source VARCHAR(50), -- 'local', 'fallback'
    status_code INTEGER,
    bytes_served BIGINT,
    user_agent TEXT,
    ip_address INET,
    range_request BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS content_cache_stats (
    id SERIAL PRIMARY KEY,
    cid VARCHAR(255) NOT NULL,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    total_bytes_served BIGINT DEFAULT 0,
    first_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pins_cid ON pins(cid);
CREATE INDEX IF NOT EXISTS idx_pins_access_count ON pins(access_count DESC);
CREATE INDEX IF NOT EXISTS idx_pins_last_accessed ON pins(last_accessed);
CREATE INDEX IF NOT EXISTS idx_gateway_metrics_cid ON gateway_metrics(cid);
CREATE INDEX IF NOT EXISTS idx_gateway_metrics_timestamp ON gateway_metrics(request_timestamp);
CREATE INDEX IF NOT EXISTS idx_content_cache_cid ON content_cache_stats(cid);

-- Función para actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en pins
CREATE TRIGGER update_pins_updated_at 
    BEFORE UPDATE ON pins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Vista para contenido popular (para garbage collection inteligente)
CREATE OR REPLACE VIEW popular_content AS
SELECT 
    cid,
    access_count,
    last_accessed,
    size_bytes,
    CASE 
        WHEN access_count > 100 AND last_accessed > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'hot'
        WHEN access_count > 10 AND last_accessed > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'warm'
        ELSE 'cold'
    END as temperature
FROM pins
ORDER BY access_count DESC, last_accessed DESC;

-- Insertar datos de ejemplo (opcional)
INSERT INTO pins (cid, access_count, content_type) VALUES 
('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', 150, 'audio/flac'),
('QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o', 89, 'image/jpeg')
ON CONFLICT (cid) DO NOTHING;
