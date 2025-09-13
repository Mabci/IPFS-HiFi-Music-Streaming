'use client'

import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface QualityIndicatorProps {
  format?: string
  bitrate?: number
  sampleRate?: number
  bitDepth?: number
  lossless?: boolean
  onQualityChange?: (quality: QualityLevel) => void
}

type QualityLevel = 'Baja' | 'Alta' | 'Max'

export default function QualityIndicator({ 
  format = 'AAC', 
  bitrate = 320, 
  sampleRate = 44100, 
  bitDepth = 16,
  lossless = false,
  onQualityChange
}: QualityIndicatorProps) {
  const [showPanel, setShowPanel] = useState(false)
  const [selectedQuality, setSelectedQuality] = useState<QualityLevel>('Max')

  // Determinar nivel de calidad actual basado en metadatos
  const getCurrentQuality = (): QualityLevel => {
    // Si es AAC o no es lossless, es calidad Baja
    if (format.toLowerCase() === 'aac' || (lossless === false && format.toLowerCase() !== 'flac')) {
      return 'Baja'
    }
    
    // Si es FLAC o lossless
    if (format.toLowerCase().includes('flac') || lossless === true) {
      // Max si es más de 16 bits o más de 48kHz
      if (bitDepth > 16 || sampleRate > 48000) {
        return 'Max'
      }
      return 'Alta'
    }
    
    return 'Baja'
  }

  const currentQuality = getCurrentQuality()

  const getQualityColor = (quality: QualityLevel) => {
    switch (quality) {
      case 'Baja': return 'text-yellow-500'
      case 'Alta': return 'text-blue-500'
      case 'Max': return 'text-[#00b3ad]'
      default: return 'text-gray-400'
    }
  }

  const formatSampleRate = (rate: number) => {
    return rate >= 1000 ? `${(rate / 1000).toFixed(1)}kHz` : `${rate}Hz`
  }

  const getQualityDescription = (quality: QualityLevel) => {
    switch (quality) {
      case 'Baja': return `AAC a 320kbps`
      case 'Alta': return `FLAC 16bit, 44.1kHz`
      case 'Max': return `FLAC hasta 24bit, 192kHz`
      default: return 'Desconocida'
    }
  }

  const getCurrentDescription = () => {
    if (format.toLowerCase() === 'aac') {
      return `AAC a ${bitrate}kbps`
    }
    return `FLAC ${bitDepth}bit, ${formatSampleRate(sampleRate)}`
  }

  const handleQualitySelect = (quality: QualityLevel) => {
    setSelectedQuality(quality)
    onQualityChange?.(quality)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all hover:bg-white/10 ${getQualityColor(currentQuality)} border border-white/20`}
      >
        {currentQuality}
        <ChevronDown className={`w-3 h-3 transition-transform ${showPanel ? 'rotate-180' : ''}`} />
      </button>

      {showPanel && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-black/95 backdrop-blur border border-white/20 rounded-lg shadow-xl p-4 z-50">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-3 text-white">Calidad del audio</h4>
              <div className="space-y-2">
                {(['Baja', 'Alta', 'Max'] as QualityLevel[]).map((quality) => (
                  <button
                    key={quality}
                    onClick={() => handleQualitySelect(quality)}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full border-2 ${
                        selectedQuality === quality 
                          ? `${getQualityColor(quality).replace('text-', 'border-')} ${getQualityColor(quality).replace('text-', 'bg-')}`
                          : 'border-gray-500'
                      }`}>
                        {selectedQuality === quality && (
                          <Check className="w-2 h-2 text-white m-0.5" />
                        )}
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${getQualityColor(quality)}`}>
                          {quality}
                        </div>
                        <div className="text-xs text-gray-400">
                          {getQualityDescription(quality)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-3">
              <div className="text-xs text-gray-400 mb-1">REPRODUCIENDO ACTUALMENTE EN</div>
              <div className={`text-sm font-medium ${getQualityColor(currentQuality)}`}>
                {currentQuality.toUpperCase()}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {getCurrentDescription()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
