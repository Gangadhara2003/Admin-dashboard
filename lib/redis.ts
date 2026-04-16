import Redis from 'ioredis';

// Default TTL: 1 hour (3600 seconds)
const DEFAULT_TTL = 3600;

let _client: Redis | null = null;

/**
 * Singleton Redis client.
 * Uses REDIS_URL from environment variables.
 * Falls back gracefully — if Redis is unavailable, caching is simply skipped.
 */
export function getRedisClient(): Redis | null {
  if (_client) return _client;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — caching disabled');
    return null;
  }

  try {
    _client = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    _client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    _client.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    _client.connect().catch(() => {
      console.warn('[Redis] Initial connect failed — will retry on next use');
      _client = null;
    });

    return _client;
  } catch (err: any) {
    console.error('[Redis] Init error:', err.message);
    return null;
  }
}

/**
 * Get cached data by key.
 * Returns parsed JSON or null if not found / Redis unavailable.
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;

    const data = await client.get(key);
    if (!data) return null;

    return JSON.parse(data) as T;
  } catch (err: any) {
    console.error(`[Redis] getCache error for "${key}":`, err.message);
    return null;
  }
}

/**
 * Set cache with a TTL.
 * @param key   - Cache key
 * @param data  - Data to cache (will be JSON.stringified)
 * @param ttl   - Time-to-live in seconds (default: 3600 = 1 hour)
 */
export async function setCache(key: string, data: any, ttl: number = DEFAULT_TTL): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    await client.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (err: any) {
    console.error(`[Redis] setCache error for "${key}":`, err.message);
  }
}

/**
 * Invalidate (delete) a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    await client.del(key);
  } catch (err: any) {
    console.error(`[Redis] invalidateCache error for "${key}":`, err.message);
  }
}

/**
 * Invalidate all cache keys matching a pattern.
 * Uses SCAN to avoid blocking Redis on large keyspaces.
 * @param pattern - Glob pattern, e.g. "shopify:*" or "dashboard:*"
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err: any) {
    console.error(`[Redis] invalidateCachePattern error for "${pattern}":`, err.message);
  }
}

// ─── Predefined Cache Keys ──────────────────────────────────────────────────
export const CACHE_KEYS = {
  SHOPIFY_ANALYTICS: 'shopify:analytics',
  SHOPIFY_PRODUCTS: 'shopify:products',
  SHOPIFY_INVENTORY: 'shopify:inventory',
  SHOPIFY_ORDERS: (limit: string, status: string) => `shopify:orders:${status}:${limit}`,
  SHOPIFY_CUSTOMERS: (limit: string) => `shopify:customers:${limit}`,
  SUPPLIER_ORDERS: (query: string) => `supplier-orders:${query}`,
  SUPPLIER_PRODUCTS: (query: string) => `supplier-products:${query}`,
  DASHBOARD_OVERVIEW: 'dashboard:overview',
};
