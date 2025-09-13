-- Migración para expandir el catálogo global de música
-- Añade campos faltantes y optimizaciones para el catálogo público

-- Expandir tabla Artist con más metadatos
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "country" VARCHAR(100);
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "genres" TEXT[]; -- Array de géneros
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "imageCid" VARCHAR(255);
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "followerCount" INTEGER DEFAULT 0;

-- Expandir tabla Album con más metadatos
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "genres" TEXT[]; -- Array de géneros
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "totalTracks" INTEGER;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "totalDurationSec" INTEGER;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "releaseDate" DATE;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "recordLabel" VARCHAR(255);
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "catalogNumber" VARCHAR(100);
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT TRUE;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "playCount" INTEGER DEFAULT 0;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER DEFAULT 0;

-- Expandir tabla Track con más metadatos
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "isrc" VARCHAR(50);
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "bitsPerSample" INTEGER;
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "channels" INTEGER DEFAULT 2;
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "playCount" INTEGER DEFAULT 0;
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER DEFAULT 0;
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT TRUE;

-- Nueva tabla para géneros musicales
CREATE TABLE IF NOT EXISTS "Genre" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" VARCHAR(100) NOT NULL UNIQUE,
    "slug" VARCHAR(100) NOT NULL UNIQUE,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "Genre_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Genre"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Tabla de relación muchos-a-muchos para Artist-Genre
CREATE TABLE IF NOT EXISTS "ArtistGenre" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "artistId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ArtistGenre_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtistGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtistGenre_artistId_genreId_key" UNIQUE ("artistId", "genreId")
);

-- Tabla de relación muchos-a-muchos para Album-Genre
CREATE TABLE IF NOT EXISTS "AlbumGenre" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "albumId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "AlbumGenre_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumGenre_albumId_genreId_key" UNIQUE ("albumId", "genreId")
);

-- Nueva tabla para releases/lanzamientos (para manejar diferentes versiones de álbumes)
CREATE TABLE IF NOT EXISTS "Release" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "albumId" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "releaseType" VARCHAR(50) NOT NULL, -- 'album', 'single', 'ep', 'compilation'
    "status" VARCHAR(50) NOT NULL DEFAULT 'released', -- 'released', 'upcoming', 'cancelled'
    "releaseDate" DATE,
    "country" VARCHAR(100),
    "barcode" VARCHAR(50),
    "manifestCid" VARCHAR(255), -- CID del manifest.json
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "Release_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Nueva tabla para calidades de audio disponibles
CREATE TABLE IF NOT EXISTS "AudioQuality" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "trackId" TEXT NOT NULL,
    "quality" VARCHAR(50) NOT NULL, -- 'LOW', 'HIGH', 'MAX'
    "codec" VARCHAR(20) NOT NULL, -- 'aac', 'flac'
    "bitrateKbps" INTEGER,
    "sampleRateHz" INTEGER,
    "bitsPerSample" INTEGER,
    "channels" INTEGER DEFAULT 2,
    "lossless" BOOLEAN DEFAULT FALSE,
    "fileCid" VARCHAR(255) NOT NULL,
    "fileSizeBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "AudioQuality_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AudioQuality_trackId_quality_key" UNIQUE ("trackId", "quality")
);

-- Nueva tabla para estadísticas globales
CREATE TABLE IF NOT EXISTS "GlobalStats" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "totalArtists" INTEGER DEFAULT 0,
    "totalAlbums" INTEGER DEFAULT 0,
    "totalTracks" INTEGER DEFAULT 0,
    "totalUsers" INTEGER DEFAULT 0,
    "totalPlays" BIGINT DEFAULT 0,
    "totalStorageBytes" BIGINT DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para trending/populares
CREATE TABLE IF NOT EXISTS "TrendingContent" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "contentType" VARCHAR(20) NOT NULL, -- 'artist', 'album', 'track'
    "contentId" TEXT NOT NULL,
    "score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "period" VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "TrendingContent_contentType_contentId_period_date_key" UNIQUE ("contentType", "contentId", "period", "date")
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS "idx_artist_genres" ON "Artist" USING GIN ("genres");
CREATE INDEX IF NOT EXISTS "idx_artist_verified" ON "Artist" ("isVerified");
CREATE INDEX IF NOT EXISTS "idx_artist_follower_count" ON "Artist" ("followerCount" DESC);

CREATE INDEX IF NOT EXISTS "idx_album_genres" ON "Album" USING GIN ("genres");
CREATE INDEX IF NOT EXISTS "idx_album_public" ON "Album" ("isPublic");
CREATE INDEX IF NOT EXISTS "idx_album_play_count" ON "Album" ("playCount" DESC);
CREATE INDEX IF NOT EXISTS "idx_album_release_date" ON "Album" ("releaseDate" DESC);

CREATE INDEX IF NOT EXISTS "idx_track_public" ON "Track" ("isPublic");
CREATE INDEX IF NOT EXISTS "idx_track_play_count" ON "Track" ("playCount" DESC);
CREATE INDEX IF NOT EXISTS "idx_track_duration" ON "Track" ("durationSec");

CREATE INDEX IF NOT EXISTS "idx_genre_slug" ON "Genre" ("slug");
CREATE INDEX IF NOT EXISTS "idx_genre_parent" ON "Genre" ("parentId");

CREATE INDEX IF NOT EXISTS "idx_audio_quality_track" ON "AudioQuality" ("trackId");
CREATE INDEX IF NOT EXISTS "idx_audio_quality_codec" ON "AudioQuality" ("codec");
CREATE INDEX IF NOT EXISTS "idx_audio_quality_lossless" ON "AudioQuality" ("lossless");

CREATE INDEX IF NOT EXISTS "idx_trending_score" ON "TrendingContent" ("score" DESC);
CREATE INDEX IF NOT EXISTS "idx_trending_date" ON "TrendingContent" ("date" DESC);

-- Insertar géneros básicos
INSERT INTO "Genre" ("name", "slug", "description") VALUES
('Electronic', 'electronic', 'Música electrónica y sus subgéneros'),
('Rock', 'rock', 'Rock y sus variaciones'),
('Pop', 'pop', 'Música popular contemporánea'),
('Hip Hop', 'hip-hop', 'Hip hop, rap y géneros relacionados'),
('Jazz', 'jazz', 'Jazz tradicional y contemporáneo'),
('Classical', 'classical', 'Música clásica y orquestal'),
('Folk', 'folk', 'Música folk y tradicional'),
('Blues', 'blues', 'Blues y géneros relacionados'),
('Reggae', 'reggae', 'Reggae y música caribeña'),
('Country', 'country', 'Música country y americana')
ON CONFLICT ("name") DO NOTHING;

-- Insertar subgéneros de Electronic
INSERT INTO "Genre" ("name", "slug", "description", "parentId") VALUES
('House', 'house', 'House music', (SELECT "id" FROM "Genre" WHERE "slug" = 'electronic')),
('Techno', 'techno', 'Techno music', (SELECT "id" FROM "Genre" WHERE "slug" = 'electronic')),
('Ambient', 'ambient', 'Ambient electronic', (SELECT "id" FROM "Genre" WHERE "slug" = 'electronic')),
('Drum & Bass', 'drum-bass', 'Drum and bass', (SELECT "id" FROM "Genre" WHERE "slug" = 'electronic'))
ON CONFLICT ("name") DO NOTHING;

-- Insertar estadísticas globales iniciales
INSERT INTO "GlobalStats" ("id") VALUES ('global-stats-singleton')
ON CONFLICT ("id") DO NOTHING;
