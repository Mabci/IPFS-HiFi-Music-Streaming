"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import * as Slider from '@radix-ui/react-slider'
import { buildGatewayUrl } from '@/lib/ipfs'
import { fetchFileToBlob } from '@/lib/helia'
import { extractFromBlob, extractFromHttp, type TrackMetadata } from '@/lib/metadata'
import { findCover, coverFromMB } from '@/lib/cover'
import { usePlayerStore } from '@/lib/state/player'
import { findLocalCoverHttp } from '@/lib/album'
import { isLiked, likeTrack, unlikeTrack } from '@/lib/likes'
import AuthModal from '@/components/AuthModal'
import QualityIndicator from '@/components/QualityIndicator'
import ProgressivePlayer, { type ProgressivePlayerRef } from '@/components/ProgressivePlayer'

const PlayIcon = dynamic(() => import('lucide-react').then(m => m.Play), { ssr: false })
const PauseIcon = dynamic(() => import('lucide-react').then(m => m.Pause), { ssr: false })
const SkipBackIcon = dynamic(() => import('lucide-react').then(m => m.SkipBack), { ssr: false })
const SkipForwardIcon = dynamic(() => import('lucide-react').then(m => m.SkipForward), { ssr: false })
const VolumeIcon = dynamic(() => import('lucide-react').then(m => m.Volume2), { ssr: false })
const VolumeXIcon = dynamic(() => import('lucide-react').then(m => m.VolumeX), { ssr: false })
const ShuffleIcon = dynamic(() => import('lucide-react').then(m => m.Shuffle), { ssr: false })
const RepeatIcon = dynamic(() => import('lucide-react').then(m => m.Repeat), { ssr: false })
const CloseIcon = dynamic(() => import('lucide-react').then(m => m.X), { ssr: false })
const HeartIcon = dynamic(() => import('lucide-react').then(m => m.Heart), { ssr: false })
const HeartOffIcon = dynamic(() => import('lucide-react').then(m => m.HeartOff), { ssr: false })
const MaximizeIcon = dynamic(() => import('lucide-react').then(m => m.Maximize2), { ssr: false })
const MinimizeIcon = dynamic(() => import('lucide-react').then(m => m.Minimize2), { ssr: false })
const WifiIcon = dynamic(() => import('lucide-react').then(m => m.Wifi), { ssr: false })
const WifiOffIcon = dynamic(() => import('lucide-react').then(m => m.WifiOff), { ssr: false })

export default function ModernPlayer() {
  const [cid, setCid] = useState<string>('')
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(false)
  const [meta, setMeta] = useState<TrackMetadata>({})
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined)
  const attemptedCoversRef = useRef<Set<string>>(new Set())

  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [seeking, setSeeking] = useState<number | null>(null)
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressivePlayerRef = useRef<ProgressivePlayerRef | null>(null)

  // Estado global del reproductor
  const queue = usePlayerStore((s) => s.queue)
  const currentIndex = usePlayerStore((s) => s.currentIndex)
  const nextInQueue = usePlayerStore((s) => s.next)
  const prevInQueue = usePlayerStore((s) => s.prev)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const setStoreVolume = usePlayerStore((s) => s.setVolume)
  const repeat = usePlayerStore((s) => s.repeat)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat)
  const p2pEnabled = usePlayerStore((s) => s.p2pEnabled)
  const setP2pEnabled = usePlayerStore((s) => s.setP2pEnabled)
  const isExpanded = usePlayerStore((s) => s.isExpanded)
  const toggleExpanded = usePlayerStore((s) => s.toggleExpanded)
  const playAt = usePlayerStore((s) => s.playAt)
  
  const queueMode = queue.length > 0 && currentIndex >= 0
  const currentItem = queueMode ? queue[currentIndex] : undefined

  // ID para likes
  const trackLikeId = useMemo(() => {
    if (queueMode) {
      return currentItem?.fileCid || currentItem?.httpUrl || currentItem?.id || ''
    }
    return cid || ''
  }, [queueMode, currentItem?.fileCid, currentItem?.httpUrl, currentItem?.id, cid])

  const LOCAL_COVERS_ONLY =
    (process.env.NEXT_PUBLIC_COVERS_LOCAL_ONLY || '').toLowerCase() === 'true' ||
    process.env.NEXT_PUBLIC_COVERS_LOCAL_ONLY === '1'

  // Etiqueta de calidad mejorada
  const qualityLabel = useMemo(() => {
    const bits = meta?.bitsPerSample
    const sr = meta?.sampleRateHz
    const br = meta?.bitrateKbps
    const codecRaw = (meta?.codec || '').toLowerCase()

    const codec = (() => {
      if (!codecRaw) return undefined
      if (codecRaw.includes('flac')) return 'FLAC'
      if (codecRaw.includes('alac')) return 'ALAC'
      if (codecRaw.includes('aac')) return 'AAC'
      if (codecRaw.includes('mp3') || codecRaw.includes('mpeg')) return 'MP3'
      if (codecRaw.includes('opus')) return 'Opus'
      if (codecRaw.includes('vorbis') || codecRaw.includes('ogg')) return 'Vorbis'
      if (codecRaw.includes('wav') || codecRaw.includes('pcm')) return 'PCM/WAV'
      return codecRaw.split(/[\s/-]+/)[0]?.toUpperCase()
    })()

    const parts: string[] = []
    if (codec) parts.push(codec)
    if (typeof sr === 'number' && sr > 0) {
      const khz = (sr / 1000)
      const pretty = Math.round(khz * 10) / 10
      parts.push(`${pretty} kHz`)
    }
    if (typeof br === 'number' && br > 0) parts.push(`${br} kbps`)
    if (typeof bits === 'number' && bits > 0) parts.push(`${bits}-bit`)

    return parts.join(' • ')
  }, [meta?.codec, meta?.sampleRateHz, meta?.bitrateKbps, meta?.bitsPerSample])

  const httpSrc = useMemo(() => {
    if (queueMode) return currentItem?.httpUrl
    return cid ? buildGatewayUrl(cid) : undefined
  }, [queueMode, currentItem?.httpUrl, cid])
  
  const src = p2pEnabled ? blobUrl : httpSrc
  
  // Determinar si usar streaming progresivo con calidades
  const useProgressive = currentItem?.qualities && Object.keys(currentItem.qualities).length > 0
  const progressiveCid = useProgressive ? (currentItem?.qualities?.high || currentItem?.qualities?.low || currentItem?.fileCid) : undefined
  
  // Debug logging
  console.log('ModernPlayer debug:', {
    useProgressive,
    progressiveCid,
    currentItemQualities: currentItem?.qualities,
    currentItemFileCid: currentItem?.fileCid,
    currentItemId: currentItem?.id
  })

  // Consultar likes
  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        if (!trackLikeId) { setLiked(false); return }
        const v = await isLiked('track', trackLikeId)
        if (!cancelled) setLiked(v)
      } catch {
        if (!cancelled) setLiked(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [trackLikeId])

  const toggleLike = async () => {
    if (!trackLikeId || likeBusy) return
    setLikeBusy(true)
    try {
      if (liked) {
        await unlikeTrack(trackLikeId)
        setLiked(false)
      } else {
        await likeTrack(trackLikeId)
        setLiked(true)
      }
    } catch (e) {
      console.error('like toggle error', e)
      const msg = (e as any)?.message || ''
      if (msg === 'not_authenticated') {
        setAuthOpen(true)
      }
    } finally {
      setLikeBusy(false)
    }
  }

  // Cargar metadata y portadas (simplificado para el ejemplo)
  useEffect(() => {
    let cancelled = false
    let currentBlobUrl: string | undefined

    async function run() {
      if (!queueMode && !cid) {
        setBlobUrl(undefined)
        setMeta({})
        setCoverUrl(undefined)
        setDuration(0)
        setCurrentTime(0)
        return
      }

      setLoading(true)
      try {
        const preMeta = queueMode ? currentItem?.meta : undefined
        if (p2pEnabled && (queueMode ? currentItem?.fileCid : cid)) {
          const targetCid = queueMode ? (currentItem?.fileCid || '') : cid
          const blob = await fetchFileToBlob(targetCid)
          const url = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }
          currentBlobUrl = url
          setBlobUrl(url)
          
          if (preMeta) {
            setMeta(preMeta)
            setCoverUrl(preMeta.coverUrl)
          } else {
            const m = await extractFromBlob(blob)
            setMeta(m)
            setCoverUrl(m.coverUrl)
          }
        } else if (httpSrc) {
          setBlobUrl(undefined)
          if (preMeta) {
            setMeta(preMeta)
            setCoverUrl(preMeta.coverUrl)
          } else {
            const m = await extractFromHttp(httpSrc)
            setMeta(m)
            setCoverUrl(m.coverUrl)
          }
        }
      } catch (err) {
        console.error('Error cargando fuente/metadata:', err)
        setMeta({})
        setCoverUrl(undefined)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
    }
  }, [queueMode, currentItem?.fileCid, cid, p2pEnabled, httpSrc])

  // Sincronizar volumen
  useEffect(() => {
    if (useProgressive && progressivePlayerRef.current) {
      // Usar Progressive player
      progressivePlayerRef.current.setVolume(volume)
    } else if (audioRef.current) {
      // Usar audio nativo
      audioRef.current.volume = volume
    }
  }, [volume, useProgressive])

  const onPlayPause = async () => {
    if (useProgressive && progressivePlayerRef.current) {
      // Usar Progressive player
      if (isPlaying) {
        progressivePlayerRef.current.pause()
      } else {
        try {
          await progressivePlayerRef.current.play()
        } catch (e) {
          console.error(e)
        }
      }
    } else {
      // Usar audio nativo
      const a = audioRef.current
      if (!a) return
      if (a.paused) {
        try {
          await a.play()
        } catch (e) {
          console.error(e)
        }
      } else {
        a.pause()
      }
    }
  }

  const onSeekCommit = (vals: number[]) => {
    const v = vals[0] ?? 0
    setSeeking(null)
    
    if (useProgressive && progressivePlayerRef.current) {
      // Usar Progressive player
      if (!Number.isNaN(v)) {
        progressivePlayerRef.current.seek(v)
        setCurrentTime(v)
      }
    } else {
      // Usar audio nativo
      const a = audioRef.current
      if (a && !Number.isNaN(v)) {
        a.currentTime = v
        setCurrentTime(v)
      }
    }
  }

  const displayTime = (t: number) => {
    if (!Number.isFinite(t)) return '0:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? ((seeking ?? currentTime) / duration) * 100 : 0

  // Si no hay fuente, mostrar estado vacío
  if (!src && !queueMode) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto bg-muted rounded-lg flex items-center justify-center opacity-50">
            <PlayIcon size={20} className="text-muted-foreground ml-0.5" />
          </div>
          <p className="text-muted-foreground text-sm">Selecciona una canción para reproducir</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="Inicia sesión"
        description="Necesitas iniciar sesión con Google para usar Me gusta."
        ctaLabel="Continuar con Google"
      />

      {/* Reproductor principal rediseñado */}
      <div className="flex items-center justify-between w-full">
        {/* Izquierda: Información de la canción */}
        <div className="flex items-center gap-3 min-w-0 w-80">
          <button
            onClick={toggleExpanded}
            className="relative group flex-shrink-0"
            aria-label="Expandir reproductor"
          >
            <div className="w-14 h-14 rounded overflow-hidden bg-muted hover:shadow-lg transition-all">
              {coverUrl ? (
                <img 
                  src={coverUrl} 
                  alt="Portada" 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0xNiAxNEwyNCAxOUwxNiAyNFYxNFoiIGZpbGw9IiM2NjYiLz4KPC9zdmc+';
                  }}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <PlayIcon size={20} className="text-muted-foreground" />
                </div>
              )}
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate hover:underline cursor-pointer text-white">
              {meta.title || 'Canción desconocida'}
            </div>
            <button 
              className="text-xs text-gray-400 truncate hover:underline hover:text-white transition-colors text-left"
              onClick={() => {
                if (meta.artist) {
                  const artistId = meta.artist.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                  window.location.href = `/artist/${artistId}`;
                }
              }}
            >
              {meta.artist || 'Artista desconocido'}
            </button>
          </div>

          <button
            title={liked ? 'Quitar de Me gusta' : 'Añadir a Me gusta'}
            className={`p-2 rounded-md btn-hover-scale transition-colors ${
              liked ? 'text-red-500' : 'text-gray-400'
            }`}
            disabled={!trackLikeId || likeBusy}
            onClick={toggleLike}
          >
            {liked ? <HeartIcon size={16} /> : <HeartOffIcon size={16} />}
          </button>
        </div>

        {/* Centro: Controles de reproducción y progreso */}
        <div className="flex flex-col items-center gap-2 flex-1 max-w-2xl">
          {/* Controles principales */}
          <div className="flex items-center gap-2">
            <button
              title={`Shuffle ${shuffle ? 'ON' : 'OFF'}`}
              className={`p-2 rounded-md btn-hover-scale transition-colors ${
                shuffle ? 'text-[#00b3ad]' : 'text-gray-400'
              }`}
              onClick={toggleShuffle}
            >
              <ShuffleIcon size={16} />
            </button>

            <button
              className="p-2 rounded-md btn-hover-scale transition-colors text-gray-400 disabled:opacity-50"
              disabled={!queueMode || queue.length <= 1}
              onClick={() => prevInQueue()}
              aria-label="Anterior"
            >
              <SkipBackIcon size={20} />
            </button>

            <button
              onClick={onPlayPause}
              className="w-12 h-12 play-button-gradient btn-hover-scale flex items-center justify-center rounded-full"
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                {isPlaying ? <PauseIcon size={20} className="text-white" /> : <PlayIcon size={20} className="text-white" />}
              </div>
            </button>

            <button
              className="p-2 rounded-md btn-hover-scale transition-colors text-gray-400 disabled:opacity-50"
              disabled={!queueMode || queue.length <= 1}
              onClick={() => nextInQueue()}
              aria-label="Siguiente"
            >
              <SkipForwardIcon size={20} />
            </button>

            <button
              title={`Repeat: ${repeat}`}
              className={`p-2 rounded-md btn-hover-scale transition-colors ${
                repeat !== 'off' ? 'text-[#00b3ad]' : 'text-gray-400'
              }`}
              onClick={cycleRepeat}
            >
              <RepeatIcon size={16} />
            </button>
          </div>

          {/* Barra de progreso */}
          <div className="flex items-center gap-2 w-full max-w-2xl">
            <span className="text-xs text-gray-400 tabular-nums w-10 text-right">
              {displayTime(seeking ?? currentTime)}
            </span>
            
            <div className="flex-1 progress-bar-white">
              <Slider.Root
                className="relative flex h-5 w-full touch-none select-none items-center group"
                value={[seeking ?? currentTime]}
                max={Number.isFinite(duration) && duration > 0 ? duration : 0}
                step={1}
                onValueChange={(v) => setSeeking(v[0])}
                onValueCommit={onSeekCommit}
              >
                <Slider.Track className="slider-track relative h-1 w-full grow rounded-full">
                  <Slider.Range className="slider-range absolute h-full rounded-full" />
                </Slider.Track>
                <Slider.Thumb className="slider-thumb block h-3 w-3 rounded-full shadow-sm hover:scale-110 transition-transform opacity-0 group-hover:opacity-100" />
              </Slider.Root>
            </div>
            
            <span className="text-xs text-gray-400 tabular-nums w-10">
              {displayTime(duration)}
            </span>
          </div>
        </div>

        {/* Derecha: Controles adicionales */}
        <div className="flex items-center gap-2 w-80 justify-end">
          {/* Indicador de calidad */}
          <QualityIndicator 
            format={meta.codec || 'AAC'}
            bitrate={meta.bitrateKbps || 320}
            sampleRate={meta.sampleRateHz || 44100}
            bitDepth={meta.bitsPerSample || 16}
            lossless={meta.lossless}
          />

          {/* Control de volumen */}
          <div className="flex items-center gap-2 w-32 progress-bar-white">
            <button 
              className="text-gray-400 btn-hover-scale transition-colors"
              onClick={() => setStoreVolume(volume === 0 ? 0.5 : 0)}
            >
              {volume === 0 ? <VolumeXIcon size={16} /> : <VolumeIcon size={16} />}
            </button>
            <Slider.Root
              className="relative flex h-5 w-full touch-none select-none items-center group"
              value={[Math.round(volume * 100)]}
              max={100}
              step={1}
              onValueChange={(v) => setStoreVolume((v[0] ?? 100) / 100)}
            >
              <Slider.Track className="slider-track relative h-1 w-full grow rounded-full">
                <Slider.Range className="slider-range absolute h-full rounded-full" />
              </Slider.Track>
              <Slider.Thumb className="slider-thumb block h-3 w-3 rounded-full shadow-sm hover:scale-110 transition-transform opacity-0 group-hover:opacity-100" />
            </Slider.Root>
          </div>

          <button
            title={p2pEnabled ? 'P2P activado' : 'P2P desactivado'}
            className={`p-2 rounded-md btn-hover-scale transition-colors ${
              p2pEnabled ? 'text-green-500' : 'text-gray-400'
            }`}
            onClick={() => setP2pEnabled(!p2pEnabled)}
          >
            {p2pEnabled ? <WifiIcon size={16} /> : <WifiOffIcon size={16} />}
          </button>
        </div>
      </div>

      {/* Reproductor progresivo o audio nativo */}
      {useProgressive && progressiveCid ? (
        <ProgressivePlayer
          ref={progressivePlayerRef}
          cid={progressiveCid}
          src={src}
          onLoadedMetadata={() => {
            if (progressivePlayerRef.current) {
              setDuration(progressivePlayerRef.current.getDuration() || 0)
              if (isPlaying) {
                progressivePlayerRef.current.play().catch(console.error)
              }
            }
          }}
          onTimeUpdate={(time: number) => {
            if (seeking == null) setCurrentTime(time)
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            if (queueMode) {
              if (repeat === 'one') {
                if (progressivePlayerRef.current) {
                  progressivePlayerRef.current.seek(0)
                  progressivePlayerRef.current.play().catch(console.error)
                }
              } else {
                nextInQueue()
              }
            }
          }}
          className="hidden"
        />
      ) : (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            const a = e.currentTarget
            setDuration(a.duration || 0)
            if (isPlaying) {
              a.play().catch(console.error)
            }
          }}
          onTimeUpdate={(e) => {
            if (seeking == null) setCurrentTime(e.currentTarget.currentTime)
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            if (queueMode) {
              if (repeat === 'one') {
                const a = audioRef.current
                if (a) {
                  a.currentTime = 0
                  a.play().catch(console.error)
                }
              } else {
                nextInQueue()
              }
            }
          }}
        />
      )}

      {/* Vista expandida */}
      {isExpanded && createPortal(
        <ExpandedPlayer 
          meta={meta}
          coverUrl={coverUrl}
          queue={queue}
          currentIndex={currentIndex}
          playAt={playAt}
          onClose={toggleExpanded}
          liked={liked}
          onToggleLike={toggleLike}
          shuffle={shuffle}
          onToggleShuffle={toggleShuffle}
          repeat={repeat}
          onCycleRepeat={cycleRepeat}
        />,
        document.body
      )}
    </>
  )
}

// Componente para la vista expandida
function ExpandedPlayer({
  meta,
  coverUrl,
  queue,
  currentIndex,
  playAt,
  onClose,
  liked,
  onToggleLike,
  shuffle,
  onToggleShuffle,
  repeat,
  onCycleRepeat
}: {
  meta: TrackMetadata
  coverUrl?: string
  queue: any[]
  currentIndex: number
  playAt: (index: number) => void
  onClose: () => void
  liked: boolean
  onToggleLike: () => void
  shuffle: boolean
  onToggleShuffle: () => void
  repeat: string
  onCycleRepeat: () => void
}) {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Reproductor</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Cerrar"
        >
          <CloseIcon size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
        {/* Portada y controles */}
        <div className="flex flex-col items-center space-y-6">
          <div className="w-full max-w-sm aspect-square rounded-lg overflow-hidden bg-muted">
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt="Portada" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <PlayIcon size={48} className="text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">{meta.title || 'Canción desconocida'}</h3>
            <p className="text-muted-foreground">
              {meta.artist || 'Artista desconocido'}{meta.album ? ` • ${meta.album}` : ''}
            </p>
          </div>

          {/* Controles expandidos */}
          <div className="flex items-center gap-4">
            <button
              className={`p-3 rounded-md border transition-colors ${
                liked ? 'text-red-500 border-red-500/50 bg-red-500/10' : 'hover:bg-muted'
              }`}
              onClick={onToggleLike}
            >
              <HeartIcon size={20} />
            </button>

            <button
              className={`p-3 rounded-md border transition-colors ${
                shuffle ? 'text-primary border-primary/50 bg-primary/10' : 'hover:bg-muted'
              }`}
              onClick={onToggleShuffle}
            >
              <ShuffleIcon size={20} />
            </button>

            <button
              className={`p-3 rounded-md border transition-colors ${
                repeat !== 'off' ? 'text-primary border-primary/50 bg-primary/10' : 'hover:bg-muted'
              }`}
              onClick={onCycleRepeat}
            >
              <RepeatIcon size={20} />
            </button>
          </div>
        </div>

        {/* Cola de reproducción */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium">Cola de reproducción</h4>
          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                La cola está vacía
              </div>
            ) : (
              <div className="divide-y">
                {queue.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => playAt(idx)}
                    className={`w-full p-3 text-left hover:bg-muted transition-colors ${
                      idx === currentIndex ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {item.path || item.id}
                        </div>
                      </div>
                      {idx === currentIndex && (
                        <div className="text-xs text-primary font-medium">
                          Reproduciendo
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
