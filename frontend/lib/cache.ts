export type CacheEntry<T> = {
  v: T
  e: number // epoch ms expiration
}

// Obtiene un valor cacheado con TTL desde localStorage
export function getCached<T = unknown>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (!entry || typeof entry.e !== 'number') return undefined
    if (Date.now() > entry.e) {
      // TTL vencido
      localStorage.removeItem(key)
      return undefined
    }
    return entry.v
  } catch {
    return undefined
  }
}

// Guarda un valor con TTL (ms) en localStorage
export function setCached<T = unknown>(key: string, value: T, ttlMs: number): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry<T> = { v: value, e: Date.now() + Math.max(0, ttlMs) }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Ignorar errores de cuota/serialización
  }
}
