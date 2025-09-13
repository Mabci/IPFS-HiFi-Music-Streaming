'use client'

import { useState } from 'react'
import { Code2, X } from 'lucide-react'
import AlbumLoader from './AlbumLoader'

export default function DevModal() {
  const [open, setOpen] = useState(false)

  // Solo mostrar en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-3 py-2 text-sm font-medium bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 hover:bg-yellow-500/20 rounded-md transition-colors"
      >
        <Code2 className="w-4 h-4" />
        Dev Tools
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-background border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Herramientas de Desarrollo</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-muted rounded-sm transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Content */}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Estas herramientas solo están disponibles en desarrollo para testing.
              </p>
              <AlbumLoader />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
