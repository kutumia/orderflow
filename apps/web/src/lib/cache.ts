/**
 * API Cache — in-memory LRU cache with TTL for server-side API responses.
 *
 * For production, replace with Upstash Redis:
 *   import { Redis } from "@upstash/redis";
 *   const redis = Redis.fromEnv();
 *
 * This in-memory version works well for single-server deployments
 * and Vercel serverless (each function gets fresh cache, but repeated
 * calls within the same invocation are cached).
 */

import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? Redis.fromEnv()
  : null;

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const localCache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 500;

/**
 * Get cached value or execute fetcher and cache the result.
 *
 * @param key - Cache key (e.g., "restaurant:abc123")
 * @param ttlSeconds - Time to live in seconds
 * @param fetcher - Async function that returns the data to cache
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Try Redis first
  if (redis) {
    try {
      const cachedData = await redis.get<T>(key);
      if (cachedData !== null) {
        return cachedData;
      }
    } catch (e) {
      console.warn("Redis get failed for", key, e);
    }
  } else {
    // 2. Fallback to Local Cache
    const now = Date.now();
    const entry = localCache.get(key);
    if (entry && entry.expiresAt > now) {
      return entry.data as T;
    }
  }

  // 3. Cache Miss: Fetch Data
  const data = await fetcher();

  // 4. Save to Cache
  if (redis) {
    try {
      // Ex, PX, etc are natively supported in Upstash Redis params
      await redis.setex(key, ttlSeconds, data);
    } catch (e) {
      console.warn("Redis set failed for", key, e);
    }
  } else {
    const now = Date.now();
    if (localCache.size >= MAX_ENTRIES) {
      const oldest = [...localCache.entries()]
        .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
        .slice(0, 50);
      for (const [k] of oldest) localCache.delete(k);
    }
    localCache.set(key, { data, expiresAt: now + ttlSeconds * 1000 });
  }

  return data;
}

/**
 * Invalidate cache entries matching a prefix.
 *
 * @param prefix - Key prefix to invalidate (e.g., "restaurant:abc123")
 */
export async function invalidateCache(prefix: string) {
  if (redis) {
    try {
      // Upstash Redis provides SCAN or keys pattern mapping
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (e) {
      console.warn("Redis scan/del failed for prefix", prefix, e);
    }
  } else {
    for (const key of localCache.keys()) {
      if (key.startsWith(prefix)) {
        localCache.delete(key);
      }
    }
  }
}

/**
 * Clear entire cache.
 */
export async function clearCache() {
  if (redis) {
    try {
      await redis.flushdb();
    } catch (e) {
      console.warn("Redis flushdb failed", e);
    }
  }
  localCache.clear();
}
