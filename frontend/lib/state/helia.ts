import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import type { Helia } from 'helia'
import type { UnixFS } from '@helia/unixfs'

let heliaInstance: Helia | null = null
let unixfsInstance: UnixFS | null = null

export async function getHelia(): Promise<Helia> {
  if (heliaInstance) return heliaInstance

  // Usar configuración por defecto de Helia para evitar problemas de tipos
  heliaInstance = await createHelia()
  return heliaInstance
}

export async function getUnixFS(): Promise<UnixFS> {
  if (unixfsInstance) return unixfsInstance
  
  const helia = await getHelia()
  unixfsInstance = unixfs(helia)
  return unixfsInstance
}

export async function getHeliaAndFS(): Promise<{ helia: Helia; fs: UnixFS }> {
  const helia = await getHelia()
  const fs = await getUnixFS()
  return { helia, fs }
}
