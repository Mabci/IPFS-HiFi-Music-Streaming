export function buildGatewayUrl(cid: string) {
  const base = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'http://216.238.81.58/ipfs'
  return `${base.replace(/\/$/, '')}/${cid}`
}

// Construye una URL hacia un archivo dentro de un directorio CID en el gateway
// Ej: buildGatewayPath('bafy...album', '01 - track.m4a')
export function buildGatewayPath(cid: string, ...segments: string[]) {
  const base = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'http://216.238.81.58/ipfs'
  const cleanBase = base.replace(/\/$/, '')
  const encodedPath = (segments || [])
    .filter(Boolean)
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .map((s) => encodeURIComponent(s))
    .join('/')
  return encodedPath ? `${cleanBase}/${cid}/${encodedPath}` : `${cleanBase}/${cid}`
}
