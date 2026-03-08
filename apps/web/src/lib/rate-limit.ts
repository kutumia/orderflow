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

// ─── Upstash type shapes (duck-typed to avoid hard dependency) ───
interface UpstashLimiter {
  limit(key: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
}
interface UpstashLimiters {
  checkout: UpstashLimiter;
  register: UpstashLimiter;
  login: UpstashLimiter;
  passwordReset: UpstashLimiter;
  printPoll: UpstashLimiter;
  general: UpstashLimiter;
  refund: UpstashLimiter;
  mutation: UpstashLimiter;
}

let upstashRatelimit: UpstashLimiters | null = null;

try {
  // These will only resolve if @upstash/ratelimit and @upstash/redis are installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ratelimitMod = require("@upstash/ratelimit");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const redisMod = require("@upstash/redis");

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new redisMod.Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const { Ratelimit } = ratelimitMod;
    upstashRatelimit = {
      checkout:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"),   prefix: "rl:checkout" }),
      register:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  "1 h"),   prefix: "rl:register" }),
      login:         new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"),   prefix: "rl:login" }),
      passwordReset: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,  "1 h"),   prefix: "rl:pwreset" }),
      printPoll:     new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"),   prefix: "rl:print" }),
      general:       new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"),   prefix: "rl:general" }),
      refund:        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  "1 h"),   prefix: "rl:refund" }),
      mutation:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"),   prefix: "rl:mutation" }),
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
 * Uses in-memory store. For distributed rate limiting, use checkRateLimitAsync.
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

export type RateLimitBucket =
  | "checkout"
  | "register"
  | "login"
  | "passwordReset"
  | "printPoll"
  | "general"
  | "refund"
  | "mutation";

/**
 * Async rate limit using Upstash Redis if configured, in-memory otherwise.
 *
 * Buckets:
 *   checkout      — 10/min  (payment attempts)
 *   register      — 5/hr    (account creation)
 *   login         — 10/min  (login attempts)
 *   passwordReset — 3/hr    (password resets)
 *   printPoll     — 60/min  (print agent polling)
 *   general       — 60/min  (default dashboard reads)
 *   refund        — 5/hr    (financial operations)
 *   mutation      — 30/min  (menu/category/settings writes)
 */
export async function checkRateLimitAsync(
  req: Request,
  bucket: RateLimitBucket = "general"
): Promise<Response | null> {
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
  const limits: Record<RateLimitBucket, [number, number]> = {
    checkout:      [10,  60_000],
    register:      [5,   3_600_000],
    login:         [10,  60_000],
    passwordReset: [3,   3_600_000],
    printPoll:     [60,  60_000],
    general:       [60,  60_000],
    refund:        [5,   3_600_000],
    mutation:      [30,  60_000],
  };
  const [max, window] = limits[bucket];
  return checkRateLimit(req, max, window);
}

// Re-export NextResponse for convenience (avoids unused import warnings in callers)
export { NextResponse };
