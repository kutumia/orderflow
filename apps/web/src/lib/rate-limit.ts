/**
 * Rate limiter for OrderFlow API routes.
 *
 * PRODUCTION (Vercel):
 *   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 *   Install: npm install @upstash/ratelimit @upstash/redis
 *   Uses sliding window algorithm across all serverless instances.
 *
 * FALLBACK (Dev / No Redis):
 *   In-memory Map. Works in dev, weak on Vercel (resets per cold start).
 */

import { NextResponse } from "next/server";

// ─── Try to load Upstash (optional dependency) ───
let upstashRatelimit: any = null;
let upstashRedis: any = null;

try {
  // These will only resolve if @upstash/ratelimit and @upstash/redis are installed
  const ratelimitMod = require("@upstash/ratelimit");
  const redisMod = require("@upstash/redis");

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    upstashRedis = new redisMod.Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    upstashRatelimit = {
      checkout: new ratelimitMod.Ratelimit({
        redis: upstashRedis,
        limiter: ratelimitMod.Ratelimit.slidingWindow(10, "1 m"),
        prefix: "rl:checkout",
      }),
      register: new ratelimitMod.Ratelimit({
        redis: upstashRedis,
        limiter: ratelimitMod.Ratelimit.slidingWindow(5, "1 h"),
        prefix: "rl:register",
      }),
      login: new ratelimitMod.Ratelimit({
        redis: upstashRedis,
        limiter: ratelimitMod.Ratelimit.slidingWindow(10, "1 m"),
        prefix: "rl:login",
      }),
      passwordReset: new ratelimitMod.Ratelimit({
        redis: upstashRedis,
        limiter: ratelimitMod.Ratelimit.slidingWindow(3, "1 h"),
        prefix: "rl:pwreset",
      }),
      printPoll: new ratelimitMod.Ratelimit({
        redis: upstashRedis,
        limiter: ratelimitMod.Ratelimit.slidingWindow(60, "1 m"),
        prefix: "rl:print",
      }),
      general: new ratelimitMod.Ratelimit({
        redis: upstashRedis,
        limiter: ratelimitMod.Ratelimit.slidingWindow(60, "1 m"),
        prefix: "rl:general",
      }),
    };
  }
} catch {
  // Upstash not installed — fall through to memory store
}

// ─── In-memory fallback ───
interface RateEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateEntry>();

// Cleanup every 60s
try {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt < now) memoryStore.delete(key);
    }
  }, 60_000);
} catch {
  // Edge runtime doesn't support setInterval
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * Check rate limit. Returns 429 Response if limited, null if allowed.
 *
 * Uses Upstash Redis if configured, falls back to in-memory.
 */
export function checkRateLimit(
  req: Request,
  maxRequests: number = 60,
  windowMs: number = 60_000
): Response | null {
  const ip = getClientIp(req);
  const routeKey = new URL(req.url).pathname;
  const key = `rl:${routeKey}:${ip}`;
  const now = Date.now();

  // If Upstash is available, we use it asynchronously via a sync wrapper
  // that returns null (allow) — actual enforcement happens in checkRateLimitAsync
  // For sync callers, fall through to memory store
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again shortly." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  entry.count++;
  return null;
}

/**
 * Async rate limit using Upstash Redis. Use in API routes that can await.
 *
 * Usage:
 *   const limited = await checkRateLimitAsync(req, "checkout");
 *   if (limited) return limited;
 */
export async function checkRateLimitAsync(
  req: Request,
  bucket: "checkout" | "register" | "login" | "passwordReset" | "printPoll" | "general" = "general"
): Promise<Response | null> {
  // Use Upstash if available
  if (upstashRatelimit && upstashRatelimit[bucket]) {
    const ip = getClientIp(req);
    const { success, limit, remaining, reset } = await upstashRatelimit[bucket].limit(ip);

    if (!success) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again shortly." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
          },
        }
      );
    }

    return null;
  }

  // Fallback to memory store
  const limits: Record<string, [number, number]> = {
    checkout: [10, 60_000],
    register: [5, 3600_000],
    login: [10, 60_000],
    passwordReset: [3, 3600_000],
    printPoll: [60, 60_000],
    general: [60, 60_000],
  };
  const [max, window] = limits[bucket] || [60, 60_000];
  return checkRateLimit(req, max, window);
}
