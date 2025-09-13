import { Helia } from 'helia'
import { UnixFS } from '@helia/unixfs'

export interface HeliaHLSLoaderConfig {
  helia: Helia
  fs: UnixFS
  ipfsHash: string
  hybridMode?: boolean
  gatewayUrl?: string
  p2pTimeout?: number
  debug?: boolean
}

export default class HeliaHLSLoader {
  constructor(config: HeliaHLSLoaderConfig)
  
  load(
    context: any,
    config: any,
    callbacks: {
      onSuccess: (response: any, stats: any, context: any, networkDetails?: any) => void
      onError: (error: any, context: any, networkDetails?: any) => void
      onTimeout: (stats: any, context: any, networkDetails?: any) => void
      onProgress?: (stats: any, context: any, networkDetails?: any) => void
    }
  ): void
  
  abort(): void
  destroy(): void
}
