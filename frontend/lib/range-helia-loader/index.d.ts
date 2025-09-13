export interface RangeHeliaLoaderConfig {
  helia?: any
  fs?: any
  cid: string
  gatewayUrl?: string
  hybridMode?: boolean
  p2pTimeout?: number
  debug?: boolean | ((message: string, ...args: any[]) => void)
}

export default class RangeHeliaLoader {
  constructor(config: RangeHeliaLoaderConfig)
  
  destroy(): void
  abort(): void
  
  loadRange(start: number, end?: number): Promise<Uint8Array>
  getFileSize(): Promise<number | null>
}
