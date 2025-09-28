"use client"

import { useState, useEffect } from 'react'
import { signInGoogle, getSession, signOut, handleOAuthCallback, SessionResponse } from '../lib/auth'
import { BellIcon, MusicIcon, SparklesIcon, UploadIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useContextualUrl } from '../lib/hooks/useSubdomain'
import SearchBar from './SearchBar'

export default function Topbar() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { getArtistUrl } = useContextualUrl()
  
  const handleSearchResultSelect = (result: any) => {
    // Navegar al resultado seleccionado
    switch (result.type) {
      case 'artist':
        router.push(`/artist/${result.id}`);
        break;
      case 'album':
        router.push(`/album/${result.id}`);
        break;
      case 'track':
        // Reproducir track o navegar al álbum
        router.push(`/album/${result.album?.id}`);
        break;
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Primero manejar callback de OAuth si existe
        const oauthSuccess = await handleOAuthCallback()
        if (oauthSuccess) {
          console.log('OAuth token intercambiado exitosamente')
        }
        
        // Luego obtener sesión actual (especialmente importante después de exchange)
        const s = await getSession()
        console.log('🔄 Topbar: Setting session state:', s)
        if (mounted) setSession(s)
        
        // Si el token exchange fue exitoso, hacer un segundo getSession para asegurar estado actualizado
        if (oauthSuccess) {
          console.log('🔄 Refreshing session after successful token exchange...')
          const refreshedSession = await getSession()
          if (mounted) setSession(refreshedSession)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const onSignIn = () => {
    router.push('/auth')
  }
  
  const onSignOut = async () => {
    await signOut()
    setSession({ authenticated: false })
    router.refresh()
  }
  
  return (
    <header 
      data-topbar 
      className="glass-strong border-b border-border-primary/50 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-[1800px] px-fluid-sm">
        <div className="flex h-16 items-center justify-between">
          {/* Logo y marca */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xl font-bold">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-music rounded-lg blur-sm opacity-50" />
                <div className="relative bg-gradient-music p-2 rounded-lg">
                  <MusicIcon size={20} className="text-white" />
                </div>
              </div>
              <span className="text-gradient-music">IPFS Music</span>
            </div>
          </div>

          {/* Barra de búsqueda integrada */}
          <div className="flex-1 max-w-md mx-8">
            <SearchBar
              onResultSelect={handleSearchResultSelect}
              placeholder="Buscar canciones, álbumes, artistas…"
              className="w-full"
            />
          </div>

          {/* Acciones del usuario */}
          <div className="flex items-center gap-3">
            {/* Botón subir música (solo para usuarios autenticados) */}
            {session?.authenticated && (
              <a 
                href={getArtistUrl('/upload')}
                className="btn-glass p-2.5 rounded-xl hover-glow group relative flex items-center gap-2 px-4"
                title="Subir música"
              >
                <UploadIcon size={16} className="text-text-secondary group-hover:text-accent-primary transition-colors duration-fast" />
                <span className="text-sm font-medium text-text-secondary group-hover:text-accent-primary transition-colors duration-fast">
                  Subir música
                </span>
              </a>
            )}

            {/* Botón de notificaciones */}
            <button className="btn-glass p-2.5 rounded-xl hover-glow group relative">
              <BellIcon size={18} className="text-text-secondary group-hover:text-accent-primary transition-colors duration-fast" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent-error rounded-full animate-pulse" />
            </button>

            {/* Estado de autenticación */}
            {(() => {
              console.log('🎭 Topbar render - loading:', loading, 'session:', session)
              return loading ? (
                <div className="h-10 w-28 animate-pulse rounded-xl bg-bg-surface/60" />
              ) : session?.authenticated ? (
              <div className="flex items-center gap-3">
                {/* Avatar del usuario */}
                <div className="relative">
                  {session.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || session.user.email || "Usuario"}
                      className="w-10 h-10 rounded-xl border-2 border-border-accent object-cover hover-lift"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center text-white font-semibold hover-lift">
                      {session.user?.name?.[0] || session.user?.email?.[0] || 'U'}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent-success rounded-full border-2 border-bg-primary" />
                </div>
                
                {/* Botón cerrar sesión */}
                <button 
                  onClick={onSignOut} 
                  className="btn-glass px-4 py-2.5 rounded-xl text-sm font-medium hover-glow transition-all duration-normal"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <button 
                onClick={onSignIn} 
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover-lift"
              >
                <SparklesIcon size={16} />
                Iniciar sesión
              </button>
            )
            })()}
          </div>
        </div>
      </div>
    </header>
  )
}

