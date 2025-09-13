import PlaylistDetail from '@/components/PlaylistDetail'

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)
  return (
    <div className="space-y-4">
      <PlaylistDetail playlistId={decodedId} />
    </div>
  )
}
