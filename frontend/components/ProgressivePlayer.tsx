"use client"

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
// @ts-ignore
import RangeHeliaLoader from '@/lib/range-helia-loader/index.js'
// @ts-ignore
import { getHeliaAndFS } from '@/lib/state/helia'
import { usePlayerStore } from '@/lib/state/player'

export interface ProgressivePlayerRef {
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  getVolume: () => number
  setVolume: (volume: number) => void
}

interface ProgressivePlayerProps {
  src?: string
  cid?: string
  volume?: number
  onLoadedMetadata?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onDurationChange?: (duration: number) => void
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onError?: (error: any) => void
  className?: string
  hybridMode?: boolean
  gatewayUrl?: string
}

const ProgressivePlayer = forwardRef<ProgressivePlayerRef, ProgressivePlayerProps>(({
  src,
  cid,
  volume = 1,
  onLoadedMetadata,
  onTimeUpdate,
  onDurationChange,
  onPlay,
  onPause,
  onEnded,
  onError,
  className,
  hybridMode = true,
  gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'http://216.238.81.58/ipfs'
}, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const loaderRef = useRef<any>(null)
  const [currentSrc, setCurrentSrc] = useState<string | undefined>()
  const [isRangeSupported, setIsRangeSupported] = useState(false)
  
  // Helia store
  const p2pEnabled = usePlayerStore((s) => s.p2pEnabled)

  // Expose player methods via ref
  useImperativeHandle(ref, () => ({
    play: async () => {
      if (audioRef.current) {
        await audioRef.current.play()
      }
    },
    pause: () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    },
    seek: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time
      }
    },
    getCurrentTime: () => {
      return audioRef.current?.currentTime || 0
    },
    getDuration: () => {
      return audioRef.current?.duration || 0
    },
    getVolume: () => {
      return audioRef.current?.volume || 0
    },
    setVolume: (vol: number) => {
      if (audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, vol))
      }
    }
  }), [])

  // Check Range Request support
  useEffect(() => {
    // Most modern browsers support Range requests
    setIsRangeSupported(true)
  }, [])

  // Setup progressive streaming when source changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Cleanup previous loader
    if (loaderRef.current) {
      loaderRef.current.destroy()
      loaderRef.current = null
    }

    // Determine source
    let sourceUrl: string | undefined
    let useRangeLoader = false

    if (cid && p2pEnabled && isRangeSupported) {
      // Use Range-based P2P loader
      useRangeLoader = true
      sourceUrl = cid
    } else if (src) {
      // Direct HTTP URL
      sourceUrl = src
    } else if (cid && gatewayUrl) {
      // Fallback to direct gateway URL with proper encoding
      const pathParts = cid.split('/')
      const encodedParts = pathParts.map(part => encodeURIComponent(part))
      const encodedPath = encodedParts.join('/')
      sourceUrl = `${gatewayUrl.replace(/\/$/, '')}/ipfs/${encodedPath}`
    }

    if (!sourceUrl) {
      setCurrentSrc(undefined)
      return
    }

    if (useRangeLoader) {
      // Setup Range-based streaming with P2P hybrid
      setupRangeStreaming(audio, sourceUrl)
    } else {
      // Fallback to native progressive streaming
      setupNativeAudio(audio, sourceUrl)
    }

    setCurrentSrc(sourceUrl)

  }, [src, cid, p2pEnabled, isRangeSupported, hybridMode, gatewayUrl])

  const setupRangeStreaming = async (audio: HTMLAudioElement, cidValue: string) => {
    try {
      console.log('Setting up range streaming for:', cidValue)
      
      // Check if cidValue is a path (contains /) or just a CID
      const isPath = cidValue.includes('/')
      
      if (isPath) {
        // Para paths con caracteres especiales, usar URL directa del gateway
        const pathParts = cidValue.split('/')
        const encodedParts = pathParts.map((part: string) => encodeURIComponent(part))
        const encodedPath = encodedParts.join('/')
        const directUrl = `${gatewayUrl.replace(/\/$/, '')}/ipfs/${encodedPath}`
        console.log('Using direct gateway URL for path:', directUrl)
        setupNativeAudio(audio, directUrl)
        return
      }

      // Para CIDs simples, usar URL directa del gateway (simplificado por ahora)
      console.log('Using direct gateway URL for CID:', cidValue)
      const directUrl = `${gatewayUrl.replace(/\/$/, '')}/ipfs/${cidValue}`
      setupNativeAudio(audio, directUrl)
      
    } catch (error) {
      console.error('Range streaming setup failed:', error)
      onError?.(error)
      
      // Fallback to native audio with proper encoding
      const pathParts = cidValue.split('/')
      const encodedParts = pathParts.map((part: string) => encodeURIComponent(part))
      const encodedPath = encodedParts.join('/')
      const fallbackUrl = `${gatewayUrl.replace(/\/$/, '')}/ipfs/${encodedPath}`
      setupNativeAudio(audio, fallbackUrl)
    }
  }

  const createStreamingUrl = async (loader: any, cidValue: string): Promise<string | null> => {
    try {
      // For now, we'll use the gateway URL with Range support
      // In the future, we could implement a custom MediaSource approach
      // that uses the loader for Range requests
      
      const gatewayUrl = `${loader.gatewayUrl.replace(/\/$/, '')}/ipfs/${cidValue}`
      
      // Test if the gateway supports Range requests
      const testResponse = await fetch(gatewayUrl, {
        method: 'HEAD'
      })
      
      if (testResponse.ok && testResponse.headers.get('accept-ranges') === 'bytes') {
        return gatewayUrl
      }
      
      return null
    } catch (error) {
      console.error('Failed to create streaming URL:', error)
      return null
    }
  }

  const setupNativeAudio = (audio: HTMLAudioElement, sourceUrl: string) => {
    console.log('Setting up native audio with URL:', sourceUrl)
    audio.src = sourceUrl
    audio.load()
  }

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume))
    }
  }, [volume])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => onLoadedMetadata?.()
    const handleTimeUpdate = () => onTimeUpdate?.(audio.currentTime)
    const handleDurationChange = () => onDurationChange?.(audio.duration)
    const handlePlay = () => onPlay?.()
    const handlePause = () => onPause?.()
    const handleEnded = () => onEnded?.()
    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement
      const error = target.error
      
      // Map error codes to readable messages
      const errorMessages: { [key: number]: string } = {
        1: 'MEDIA_ERR_ABORTED - The fetching process for the media resource was aborted by the user agent',
        2: 'MEDIA_ERR_NETWORK - A network error caused the media download to fail',
        3: 'MEDIA_ERR_DECODE - An error occurred while decoding the media resource',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - The media resource is not supported'
      }
      
      const networkStates: { [key: number]: string } = {
        0: 'NETWORK_EMPTY - No data yet',
        1: 'NETWORK_IDLE - Active, not loading',
        2: 'NETWORK_LOADING - Loading data',
        3: 'NETWORK_NO_SOURCE - No source'
      }
      
      const readyStates: { [key: number]: string } = {
        0: 'HAVE_NOTHING - No data',
        1: 'HAVE_METADATA - Metadata loaded',
        2: 'HAVE_CURRENT_DATA - Current frame loaded',
        3: 'HAVE_FUTURE_DATA - Current + future frames',
        4: 'HAVE_ENOUGH_DATA - Enough data to play'
      }
      
      console.error('Audio error details:', {
        event: e.type,
        errorCode: error?.code,
        errorMessage: error?.code ? errorMessages[error.code] : 'Unknown error',
        src: target.src,
        networkState: target.networkState,
        networkStateMessage: networkStates[target.networkState],
        readyState: target.readyState,
        readyStateMessage: readyStates[target.readyState],
        currentTime: target.currentTime,
        duration: target.duration,
        paused: target.paused,
        ended: target.ended
      })
      
      // Try to get more info from the response
      if (target.src) {
        fetch(target.src, { method: 'HEAD' })
          .then(response => {
            console.log('Source URL check:', {
              url: target.src,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries())
            })
          })
          .catch(fetchError => {
            console.error('Source URL fetch failed:', fetchError)
          })
      }
      
      onError?.(e)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [onLoadedMetadata, onTimeUpdate, onDurationChange, onPlay, onPause, onEnded, onError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loaderRef.current) {
        loaderRef.current.destroy()
        loaderRef.current = null
      }
    }
  }, [])

  return (
    <audio
      ref={audioRef}
      className={className}
      preload="metadata"
      crossOrigin="anonymous"
      style={{ display: 'none' }} // Hidden, controlled via ref
    />
  )
})

ProgressivePlayer.displayName = 'ProgressivePlayer'

export default ProgressivePlayer
