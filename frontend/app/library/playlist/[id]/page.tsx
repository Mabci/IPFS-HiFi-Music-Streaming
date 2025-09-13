import PlaylistDetail from '@/components/PlaylistDetail'

export default function PlaylistPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id)
  return (
    <div className="space-y-4">
      <PlaylistDetail playlistId={id} />
    </div>
  )
}
