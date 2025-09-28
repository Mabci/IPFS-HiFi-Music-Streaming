import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TrackMetadata } from '../metadata'

export type RepeatMode = 'off' | 'one' | 'all'

export type QueueItem = {
  id: string
  fileCid?: string
  albumCid?: string
  coverCid?: string  // CID del cover del álbum (independiente de la calidad)
  path?: string
  httpUrl?: string
  blobUrl?: string
  meta?: TrackMetadata
  // Progressive streaming support (replaces HLS)
  qualities?: {
    low?: string     // AAC 320kbps CID
    high?: string    // FLAC 16/44.1 CID  
    max?: string     // FLAC 24/192 CID
  }
  selectedQuality?: 'auto' | 'low' | 'high' | 'max'
}

export type PlayerState = {
  queue: QueueItem[]
  currentIndex: number
  isPlaying: boolean
  repeat: RepeatMode
  shuffle: boolean
  volume: number
  p2pEnabled: boolean
  isExpanded: boolean

  // actions
  loadQueue: (items: QueueItem[], startIndex?: number) => void
  playAt: (index: number) => void
  next: () => void
  prev: () => void
  togglePlay: () => void
  setIsPlaying: (on: boolean) => void
  setVolume: (v: number) => void
  setP2pEnabled: (on: boolean) => void
  toggleExpanded: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      repeat: 'off',
      shuffle: false,
      volume: 1,
      p2pEnabled: false,
      isExpanded: false,

      loadQueue: (items, startIndex = 0) => {
        const idx = items.length > 0 ? Math.min(Math.max(startIndex, 0), items.length - 1) : -1
        set({ queue: items, currentIndex: idx, isPlaying: idx >= 0 })
      },

      playAt: (index) => {
        const { queue } = get()
        if (index < 0 || index >= queue.length) return
        set({ currentIndex: index, isPlaying: true })
      },

      next: () => {
        const { queue, currentIndex, repeat, shuffle } = get()
        if (queue.length === 0) return
        if (shuffle) {
          if (queue.length <= 1) return
          let rnd = currentIndex
          while (rnd === currentIndex) rnd = Math.floor(Math.random() * queue.length)
          set({ currentIndex: rnd, isPlaying: true })
          return
        }
        const last = queue.length - 1
        if (currentIndex < last) {
          set({ currentIndex: currentIndex + 1, isPlaying: true })
        } else if (repeat === 'all') {
          set({ currentIndex: 0, isPlaying: true })
        } else if (repeat === 'one') {
          set({ isPlaying: true })
        } else {
          set({ isPlaying: false })
        }
      },

      prev: () => {
        const { queue, currentIndex, repeat } = get()
        if (queue.length === 0) return
        if (currentIndex > 0) {
          set({ currentIndex: currentIndex - 1, isPlaying: true })
        } else if (repeat === 'all') {
          set({ currentIndex: queue.length - 1, isPlaying: true })
        } else if (repeat === 'one') {
          set({ isPlaying: true })
        } else {
          set({ isPlaying: false })
        }
      },

      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
      setIsPlaying: (on) => set({ isPlaying: on }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setP2pEnabled: (on) => set({ p2pEnabled: on }),
      toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      cycleRepeat: () =>
        set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
    }),
    {
      name: 'player-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        queue: s.queue,
        currentIndex: s.currentIndex,
        repeat: s.repeat,
        shuffle: s.shuffle,
        volume: s.volume,
        p2pEnabled: s.p2pEnabled,
        isExpanded: s.isExpanded,
      }),
    }
  )
)
