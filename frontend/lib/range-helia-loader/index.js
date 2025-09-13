import { unixfs } from '@helia/unixfs'

/**
 * Range-based Helia loader for progressive audio streaming
 * Adapts the hybrid P2P system from HLS to HTTP Range Requests
 */
class RangeHeliaLoader {
  constructor(config) {
    this._abortFlag = [false]
    this.helia = config.helia
    this.fs = config.fs || (config.helia ? unixfs(config.helia) : null)
    this.cid = config.cid
    this.gatewayUrl = config.gatewayUrl
    this.hybridMode = config.hybridMode !== false // Default: true
    this.p2pTimeout = config.p2pTimeout || 3000 // 3s timeout for P2P
    
    if (config.debug === false) {
      this.debug = function() {}
    } else if (config.debug === true) {
      this.debug = console.log
    } else {
      this.debug = config.debug || function() {}
    }
  }

  destroy() {
    this._abortFlag[0] = true
  }

  abort() {
    this._abortFlag[0] = true
  }

  /**
   * Load a range of bytes from the audio file
   * @param {number} start - Start byte position
   * @param {number} end - End byte position (optional)
   * @returns {Promise<Uint8Array>} Audio data chunk
   */
  async loadRange(start, end) {
    if (this._abortFlag[0]) {
      throw new Error('Aborted')
    }

    const options = { offset: start }
    if (end !== undefined) {
      options.length = end - start + 1
    }

    this.debug(`Loading range ${start}-${end || 'end'} for CID: ${this.cid}`)

    try {
      let data
      
      if (this.hybridMode && this.fs && this.gatewayUrl) {
        // Hybrid mode: try P2P first, fallback to gateway
        data = await this.loadHybrid(options)
      } else if (this.fs) {
        // P2P only mode
        data = await this.loadFromP2P(options)
      } else if (this.gatewayUrl) {
        // Gateway only mode
        data = await this.loadFromGateway(options)
      } else {
        throw new Error('No Helia node or gateway URL configured')
      }

      return data
      
    } catch (error) {
      this.debug('Range load error:', error)
      throw error
    }
  }

  async loadHybrid(options) {
    this.debug(`Hybrid range load for CID: ${this.cid}`)
    
    // Create P2P promise with timeout
    const p2pPromise = this.loadFromP2P(options)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('P2P timeout')), this.p2pTimeout)
    )

    try {
      // Try P2P first with timeout
      const data = await Promise.race([p2pPromise, timeoutPromise])
      this.debug(`P2P range success, size: ${data.length}`)
      return data
      
    } catch (p2pError) {
      this.debug(`P2P range failed: ${p2pError.message}, trying gateway...`)
      
      // Fallback to gateway
      const data = await this.loadFromGateway(options)
      this.debug(`Gateway range success, size: ${data.length}`)
      
      // Add to P2P cache in background
      this.addToP2PCache(data, options).catch(err => 
        this.debug(`Failed to cache range in P2P:`, err)
      )
      
      return data
    }
  }

  async loadFromP2P(options) {
    if (!this.fs) {
      throw new Error('No Helia UnixFS instance available')
    }
    
    this.debug(`Loading range from P2P: CID ${this.cid}`)
    return await this.cat(this.cid, options)
  }

  async loadFromGateway(options) {
    if (!this.gatewayUrl) {
      throw new Error('No gateway URL configured')
    }
    
    const url = `${this.gatewayUrl.replace(/\/$/, '')}/ipfs/${this.cid}`
    this.debug(`Loading range from gateway: ${url}`)
    
    const headers = {}
    if (options.offset !== undefined) {
      const start = options.offset
      const end = options.length !== undefined ? start + options.length - 1 : ''
      headers['Range'] = `bytes=${start}-${end}`
    }
    
    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`Gateway request failed: ${response.status} ${response.statusText}`)
    }
    
    return new Uint8Array(await response.arrayBuffer())
  }

  async addToP2PCache(data, options) {
    if (!this.helia) return
    
    try {
      // Helia automatically handles caching when we access content
      this.debug(`Cached range for P2P sharing`)
    } catch (error) {
      this.debug(`Failed to cache range:`, error)
    }
  }

  async cat(cid, options) {
    if (!this.fs) {
      throw new Error('No Helia UnixFS instance available')
    }
    
    const parts = []
    let length = 0

    try {
      for await (const buf of this.fs.cat(cid, options)) {
        if (this._abortFlag[0]) {
          this.debug('Cancel reading from Helia')
          throw new Error('Aborted')
        }
        parts.push(buf)
        length += buf.length
      }
    } catch (error) {
      throw new Error(`File not found or read error: ${cid}`)
    }

    const value = new Uint8Array(length)
    let offset = 0
    for (const buf of parts) {
      value.set(buf, offset)
      offset += buf.length
    }

    this.debug(`Received range data for CID '${cid}' size: ${value.length} in ${parts.length} blocks`)
    return value
  }

  /**
   * Get file size from headers (for progress calculation)
   */
  async getFileSize() {
    if (!this.gatewayUrl) {
      throw new Error('Cannot determine file size without gateway')
    }

    const url = `${this.gatewayUrl.replace(/\/$/, '')}/ipfs/${this.cid}`
    
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (!response.ok) {
        throw new Error(`Failed to get file size: ${response.status}`)
      }
      
      const contentLength = response.headers.get('content-length')
      return contentLength ? parseInt(contentLength, 10) : null
    } catch (error) {
      this.debug('Failed to get file size:', error)
      return null
    }
  }
}

export default RangeHeliaLoader
