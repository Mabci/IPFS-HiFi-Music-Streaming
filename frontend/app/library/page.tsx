import LikesPanel from '@/components/LikesPanel'
import PlaylistsPanel from '@/components/PlaylistsPanel'

export default function LibraryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Mi biblioteca</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Panel de Likes */}
        <div className="min-w-0">
          <LikesPanel />
        </div>
        {/* Panel de Playlists */}
        <div className="min-w-0">
          <PlaylistsPanel />
        </div>
      </div>
    </div>
  )
}
