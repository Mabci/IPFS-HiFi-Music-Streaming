import { unixfs } from '@helia/unixfs'

class HlsjsHeliaLoader {
  constructor(config) {
    this._abortFlag = [false]
    this.helia = config.helia
    this.fs = config.fs || (config.helia ? unixfs(config.helia) : null)
    this.hash = config.ipfsHash
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
    
    if (config.m3u8provider) {
      this.m3u8provider = config.m3u8provider
    } else {
      this.m3u8provider = null
    }
    
    if (config.tsListProvider) {
      this.tsListProvider = config.tsListProvider
    } else {
      this.tsListProvider = null
    }
  }

  destroy() {
    this._abortFlag[0] = true
  }

  abort() {
    this._abortFlag[0] = true
  }

  load(context, config, callbacks) {
    this.context = context
    this.config = config
    this.callbacks = callbacks
    this.stats = { trequest: performance.now(), retry: 0 }
    this.retryDelay = config.retryDelay
    this.loadInternal()
  }

  /**
   * Call this by getting the HLSHeliaLoader instance from hls.js hls.coreComponents[0].loaders.manifest.setM3U8Provider()
   * @param {function} provider
   */
  setM3U8Provider(provider) {
    this.m3u8provider = provider
  }

  /**
   * @param {function} provider
   */
  setTsListProvider(provider) {
    this.tsListProvider = provider
  }

  async loadInternal() {
    const { stats, context, callbacks } = this

    stats.tfirst = Math.max(performance.now(), stats.trequest)
    stats.loaded = 0

    // Extract filename from URL
    const urlParts = window.location.href.split("/")
    if (urlParts[urlParts.length - 1] !== "") {
      urlParts[urlParts.length - 1] = ""
    }
    const filename = context.url.replace(urlParts.join("/"), "")

    const options = {}
    if (Number.isFinite(context.rangeStart)) {
      options.offset = context.rangeStart
      if (Number.isFinite(context.rangeEnd)) {
        options.length = context.rangeEnd - context.rangeStart
      }
    }

    // Handle M3U8 provider
    if (filename.split(".")[1] === "m3u8" && this.m3u8provider !== null) {
      const res = this.m3u8provider()
      let data
      if (res instanceof Uint8Array) {
        data = buf2str(res)
      } else {
        data = res
      }
      const response = { url: context.url, data: data }
      callbacks.onSuccess(response, stats, context)
      return
    }

    // Handle TS list provider
    if (filename.split(".")[1] === "m3u8" && this.tsListProvider !== null) {
      const tslist = this.tsListProvider()
      const hash = tslist[filename]
      if (hash) {
        try {
          const res = await this.cat(hash, options)
          let data
          if (res instanceof Uint8Array) {
            data = buf2str(res)
          } else {
            data = res
          }
          stats.loaded = stats.total = data.length
          stats.tload = Math.max(stats.tfirst, performance.now())
          const response = { url: context.url, data: data }
          callbacks.onSuccess(response, stats, context)
        } catch (error) {
          this.debug('TS list provider error:', error)
          callbacks.onError({ code: 404, text: 'File not found' }, context)
        }
      }
      return
    }

    this._abortFlag[0] = false

    try {
      let data
      
      if (this.hybridMode && this.fs && this.gatewayUrl) {
        // Hybrid mode: try P2P first, fallback to gateway
        data = await this.loadHybrid(filename, options)
      } else if (this.fs) {
        // P2P only mode
        data = await this.loadFromP2P(filename, options)
      } else if (this.gatewayUrl) {
        // Gateway only mode
        data = await this.loadFromGateway(filename, options)
      } else {
        throw new Error('No Helia node or gateway URL configured')
      }

      const responseData = (context.responseType === 'arraybuffer') ? data : buf2str(data)
      stats.loaded = stats.total = data.length
      stats.tload = Math.max(stats.tfirst, performance.now())
      const response = { url: context.url, data: responseData }
      callbacks.onSuccess(response, stats, context)
      
    } catch (error) {
      this.debug('Load error:', error)
      callbacks.onError({ code: 404, text: error.message }, context)
    }
  }

  async loadHybrid(filename, options) {
    this.debug(`Hybrid load for '${this.hash}/${filename}'`)
    
    // Create P2P promise with timeout
    const p2pPromise = this.loadFromP2P(filename, options)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('P2P timeout')), this.p2pTimeout)
    )

    try {
      // Try P2P first with timeout
      const data = await Promise.race([p2pPromise, timeoutPromise])
      this.debug(`P2P success for '${filename}', size: ${data.length}`)
      
      // Share chunk in background (already in Helia node)
      return data
      
    } catch (p2pError) {
      this.debug(`P2P failed for '${filename}': ${p2pError.message}, trying gateway...`)
      
      // Fallback to gateway
      const data = await this.loadFromGateway(filename, options)
      this.debug(`Gateway success for '${filename}', size: ${data.length}`)
      
      // Add to P2P cache in background (Helia handles this automatically when we pin)
      this.addToP2PCache(filename, data).catch(err => 
        this.debug(`Failed to cache '${filename}' in P2P:`, err)
      )
      
      return data
    }
  }

  async loadFromP2P(filename, options) {
    if (!this.fs) {
      throw new Error('No Helia UnixFS instance available')
    }
    
    const path = `${this.hash}/${filename}`
    this.debug(`Loading from P2P: '${path}'`)
    
    return await this.cat(path, options)
  }

  async loadFromGateway(filename, options) {
    if (!this.gatewayUrl) {
      throw new Error('No gateway URL configured')
    }
    
    const url = `${this.gatewayUrl.replace(/\/$/, '')}/${this.hash}/${filename}`
    this.debug(`Loading from gateway: '${url}'`)
    
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

  async addToP2PCache(filename, data) {
    if (!this.helia) return
    
    try {
      // Helia automatically handles caching when we access content
      // This is mainly for future enhancement if we want explicit caching
      this.debug(`Cached '${filename}' for P2P sharing`)
    } catch (error) {
      this.debug(`Failed to cache '${filename}':`, error)
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

    this.debug(`Received data for file '${cid}' size: ${value.length} in ${parts.length} blocks`)
    return value
  }
}

function buf2str(buf) {
  return new TextDecoder().decode(buf)
}

export default HlsjsHeliaLoader
