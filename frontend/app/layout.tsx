import '../styles/globals.css'
import type { Metadata, Viewport } from 'next'
import Topbar from '@/components/Topbar'
import SidebarNav from '@/components/SidebarNav'
import PlayerBar from '@/components/PlayerBar'

export const metadata: Metadata = {
  title: 'IPFS Music',
  description: 'Plataforma de música descentralizada sobre IPFS',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground overflow-hidden">
        {/* Layout con topbar y reproductor de esquina a esquina */}
        <div className="flex flex-col h-screen">
          {/* Topbar de esquina a esquina */}
          <div className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Topbar />
          </div>

          {/* Contenido principal con sidebar */}
          <div className="flex flex-1 min-h-0">
            {/* Sidebar debajo de topbar */}
            <aside className="hidden lg:flex w-64 flex-col bg-card border-r">
              <div className="flex-1 overflow-y-auto">
                <SidebarNav />
              </div>
            </aside>
            
            {/* Área de contenido */}
            <main className="flex-1 overflow-y-auto min-w-0">
              <div className="p-6">
                {children}
              </div>
            </main>
          </div>

          {/* PlayerBar de esquina a esquina */}
          <div className="sticky bottom-0 z-50 w-full">
            <PlayerBar />
          </div>
        </div>
      </body>
    </html>
  )
}
