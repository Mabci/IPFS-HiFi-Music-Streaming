"use client"

import { usePlayerStore } from '@/lib/state/player'
import ModernPlayer from './ModernPlayer'

export default function PlayerBar() {
  const { queue, currentIndex } = usePlayerStore()
  
  if (queue.length === 0 || currentIndex < 0) {
    return null
  }

  return (
    <div className="border-t bg-black/95 backdrop-blur px-4 py-3">
      <ModernPlayer />
    </div>
  )
}
