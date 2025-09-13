import { Play, Heart, Clock, TrendingUp, Music2, Shuffle } from 'lucide-react'
import Link from 'next/link'
import DevModal from '@/components/DevModal'

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Header con saludo */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">¡Buenas tardes!</h1>
            <p className="text-muted-foreground">Descubre nueva música en IPFS</p>
          </div>
          <div className="flex gap-2">
            <button className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <Shuffle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Acceso rápido - estilo Spotify */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickAccessCard
            title="Canciones que te gustan"
            image="💚"
            href="/library/liked"
          />
          <QuickAccessCard
            title="Reproducidas recientemente"
            image="🕒"
            href="/library/recent"
          />
          <QuickAccessCard
            title="Tus playlists"
            image="🎵"
            href="/library/playlists"
          />
          <QuickAccessCard
            title="Álbumes guardados"
            image="💿"
            href="/library/albums"
          />
          <QuickAccessCard
            title="Artistas seguidos"
            image="👤"
            href="/library/artists"
          />
          <QuickAccessCard
            title="Descubrir"
            image="✨"
            href="/discover"
          />
        </div>
      </section>

      {/* Secciones principales */}
      <section>
        <div className="space-y-8">
          {/* Reproducido recientemente */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Reproducido recientemente</h2>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                Mostrar todo
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <AlbumCard
                  key={i}
                  title={`Álbum ${i + 1}`}
                  artist="Artista Ejemplo"
                  image="🎵"
                />
              ))}
            </div>
          </div>

          {/* Tendencias */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Tendencias en IPFS</h2>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                Mostrar todo
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <AlbumCard
                  key={i}
                  title={`Trending ${i + 1}`}
                  artist="Artista Popular"
                  image="🔥"
                />
              ))}
            </div>
          </div>

          {/* Para ti */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Hecho para ti</h2>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                Mostrar todo
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <AlbumCard
                  key={i}
                  title={`Mix ${i + 1}`}
                  artist="Tu música personalizada"
                  image="🎯"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Modal de desarrollo */}
      <DevModal />
    </div>
  )
}

function QuickAccessCard({ 
  title, 
  image,
  href
}: { 
  title: string
  image: string
  href: string
}) {
  return (
    <Link 
      href={href}
      className="group flex items-center gap-4 p-3 rounded-lg glass-effect hover:bg-white/10 transition-all"
    >
      <div className="w-12 h-12 rounded-md bg-white/5 flex items-center justify-center text-xl">
        {image}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate text-white">{title}</div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#00b3ad] to-[#00fff7] text-white flex items-center justify-center">
          <Play className="w-4 h-4 ml-0.5" />
        </div>
      </div>
    </Link>
  )
}

function AlbumCard({ 
  title, 
  artist,
  image
}: { 
  title: string
  artist: string
  image: string
}) {
  return (
    <div className="group cursor-pointer p-4 rounded-lg glass-effect hover:bg-white/10 transition-all">
      <div className="relative mb-3">
        <div className="aspect-square rounded-lg bg-white/5 flex items-center justify-center text-4xl">
          {image}
        </div>
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00b3ad] to-[#00fff7] text-white flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 ml-0.5" />
          </div>
        </div>
      </div>
      <div>
        <div className="font-medium text-sm truncate text-white">{title}</div>
        <div className="text-xs text-gray-400 truncate">{artist}</div>
      </div>
    </div>
  )
}
