import { Play, Shuffle, Heart, MoreHorizontal, Clock } from 'lucide-react'

interface ArtistPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  // Await params in Next.js 15
  const { id } = await params
  
  // Por ahora, generar datos mock basados en el ID
  const artistName = id.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')

  const mockTracks = [
    { id: 1, title: "Wonderland", plays: "35,506,168", duration: "3:44" },
    { id: 2, title: "CUBE", plays: "261,543", duration: "3:22" },
    { id: 3, title: "Altalwa", plays: "29,693,661", duration: "4:31" },
    { id: 4, title: "Season", plays: "14,079,268", duration: "3:28" },
    { id: 5, title: "Faster than me", plays: "9,728,272", duration: "2:38" }
  ]

  const mockAlbums = [
    { id: 1, title: "New Song", year: "2024", cover: null },
    { id: 2, title: "Complete Collection", year: "2023", cover: null },
    { id: 3, title: "Singles", year: "2022", cover: null }
  ]

  return (
    <div className="min-h-screen">
      {/* Header con gradiente */}
      <div className="relative h-80 bg-gradient-to-b from-orange-500 to-orange-700 flex items-end">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative w-full p-6">
          <div className="flex items-end gap-6">
            {/* Avatar del artista */}
            <div className="w-48 h-48 rounded-full bg-white/20 flex items-center justify-center text-white text-6xl font-bold">
              {artistName.charAt(0)}
            </div>
            
            <div className="text-white pb-4">
              <div className="text-sm font-medium mb-2">Artista verificado</div>
              <h1 className="text-6xl font-bold mb-4">{artistName}</h1>
              <div className="text-sm opacity-90">516,117 oyentes mensuales</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles principales */}
      <div className="bg-gradient-to-b from-orange-700/20 to-transparent p-6">
        <div className="flex items-center gap-6">
          <button className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center hover:scale-105 transition-transform">
            <Play size={24} className="text-black ml-1" fill="currentColor" />
          </button>
          
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Shuffle size={32} />
          </button>
          
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Heart size={32} />
          </button>
          
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal size={32} />
          </button>
        </div>
      </div>

      <div className="px-6 pb-6">
        {/* Sección Popular */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Popular</h2>
          
          <div className="space-y-2">
            {mockTracks.map((track, index) => (
              <div 
                key={track.id}
                className="flex items-center gap-4 p-2 rounded-md hover:bg-muted/50 transition-colors group cursor-pointer"
              >
                <div className="w-4 text-muted-foreground text-sm text-right">
                  {index + 1}
                </div>
                
                <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                  <Play size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{track.title}</div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {track.plays}
                </div>
                
                <button className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Heart size={16} className="text-muted-foreground hover:text-foreground" />
                </button>
                
                <div className="text-sm text-muted-foreground w-12 text-right">
                  {track.duration}
                </div>
                
                <button className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal size={16} className="text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
          </div>
          
          <button className="mt-4 text-muted-foreground hover:text-foreground text-sm font-medium">
            Mostrar todo
          </button>
        </div>

        {/* Sección de Álbumes */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Álbumes y sencillos populares</h2>
            <button className="text-sm text-muted-foreground hover:text-foreground font-medium">
              Mostrar todo
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {mockAlbums.map((album) => (
              <div 
                key={album.id}
                className="p-4 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                  <div className="text-muted-foreground text-4xl font-bold">
                    {album.title.charAt(0)}
                  </div>
                  <button className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={24} className="text-white ml-1" fill="currentColor" />
                  </button>
                </div>
                
                <div>
                  <div className="font-medium truncate mb-1">{album.title}</div>
                  <div className="text-sm text-muted-foreground">{album.year}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
