"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home as HomeIcon, Search as SearchIcon, Library as LibraryIcon, ListMusic as ListMusicIcon, TrendingUp as TrendingUpIcon, Radio as RadioIcon, Heart as HeartIcon, Clock as ClockIcon } from "lucide-react"

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="h-full w-full p-4 space-y-4">
      {/* Navegación principal */}
      <div className="space-y-1">
        <MenuItem 
          href="/" 
          icon={<HomeIcon size={18} />} 
          label="Inicio" 
          active={pathname === '/'}
        />
        <MenuItem 
          href="/search" 
          icon={<SearchIcon size={18} />} 
          label="Buscar" 
          active={pathname === '/search'}
        />
        <MenuItem 
          href="/library" 
          icon={<LibraryIcon size={18} />} 
          label="Tu Biblioteca" 
          active={pathname === '/library'}
        />
      </div>

      {/* Separador */}
      <div className="h-px bg-border/50" />

      {/* Descubrir */}
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Descubrir
        </div>
        <MenuItem 
          href="/trending" 
          icon={<TrendingUpIcon size={18} />} 
          label="Tendencias" 
          active={pathname === '/trending'}
        />
        <MenuItem 
          href="/radio" 
          icon={<RadioIcon size={18} />} 
          label="Radio IPFS" 
          active={pathname === '/radio'}
        />
      </div>

      {/* Separador */}
      <div className="h-px bg-border/50" />

      {/* Mi música */}
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Mi Música
        </div>
        <MenuItem 
          href="/liked" 
          icon={<HeartIcon size={18} />} 
          label="Me gusta" 
          active={pathname === '/liked'}
        />
        <MenuItem 
          href="/recent" 
          icon={<ClockIcon size={18} />} 
          label="Recientes" 
          active={pathname === '/recent'}
        />
      </div>

      {/* Separador */}
      <div className="h-px bg-border/50" />

      {/* Playlists */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <ListMusicIcon size={14} />
            Playlists
          </div>
        </div>
        <MenuItem 
          href="/playlist/demo" 
          icon={<div className="w-4 h-4 bg-primary rounded-sm" />} 
          label="Demo Playlist" 
          active={pathname === '/playlist/demo'}
        />
      </div>
    </nav>
  )
}

function MenuItem({ 
  href, 
  icon, 
  label, 
  active = false 
}: { 
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
        active 
          ? 'bg-primary text-primary-foreground' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      <span className="transition-colors">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {active && (
        <div className="ml-auto w-1 h-4 bg-primary-foreground rounded-full" />
      )}
    </Link>
  )
}
