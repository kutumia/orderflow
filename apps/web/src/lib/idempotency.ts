/**
 * Idempotency key management for critical write operations.
 * E3-T02 — Idempotency model for checkout, refunds, and print jobs.
 *
 * Idempotency guarantees: submitting the same operation multiple times
 * (e.g. network retry) produces the same result without duplicate effects.
 *
 * Pattern:
 *   1. Client sends `Idempotency-Key: <uuid>` header on POST
 *   2. Server checks cache/DB for existing response for this key
 *   3. If found: return cached response (HTTP 200 with same body)
 *   4. If not found: execute operation, store result, return response
 *
 * Idempotency keys expire after 24 hours.
 *
 * Usage:
 *   const key = req.headers.get("Idempotency-Key");
 *   const cached = await checkIdempotency(key, restaurantId);
 *   if (cached) return NextResponse.json(cached.body, { status: cached.status });
 *   // ... execute operation ...
 *   await storeIdempotency(key, restaurantId, { body: result, status: 200 });
 */

import { supabaseAdmin } from "@/lib/supabase";
import { log } from "@/lib/logger";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface IdempotencyRecord {
  status: number;
  body: unknown;
}

/**
 * Validate that an idempotency key is well-formed.
 */
export function validateIdempotencyKey(key: string | null): key is string {
  if (!key) return false;
  // Must be a UUID v4 or similar unique identifier
  return /^[a-zA-Z0-9_-]{16,64}$/.test(key);
}

/**
 * Check if a request with this idempotency key has already been processed.
 * Returns the cached response or null if this is a new request.
 */
export async function checkIdempotency(
  key: string | null,
  scope: string
): Promise<IdempotencyRecord | null> {
  if (!validateIdempotencyKey(key)) return null;

  try {
    const { data } = await supabaseAdmin
      .from("idempotency_keys")
      .select("response_status, response_body, created_at")
      .eq("key", key)
      .eq("scope", scope)
      .single();

    if (!data) return null;

    // Check TTL
    const createdAt = new Date(data.created_at as string).getTime();
    if (Date.now() - createdAt > IDEMPOTENCY_TTL_MS) {
      // Expired — treat as new request
      return null;
    }

    log.info("Idempotency cache hit", { key, scope });
    return {
      status: data.response_status as number,
      body: data.response_body,
    };
  } catch {
    // If idempotency table doesn't exist yet, gracefully degrade
    return null;
  }
}

/**
 * Store the result of a successfully processed request.
 */
export async function storeIdempotency(
  key: string | null,
  scope: string,
  record: IdempotencyRecord
): Promise<void> {
  if (!validateIdempotencyKey(key)) return;

  try {
    await supabaseAdmin
      .from("idempotency_keys")
      .upsert({
        key,
        scope,
        response_status: record.status,
        response_body: record.body,
        created_at: new Date().toISOString(),
      }, { onConflict: "key,scope" });
  } catch {
    // Non-fatal — operation succeeded, idempotency store failure is acceptable
    log.warn("Failed to store idempotency key", { key, scope });
  }
}

/**
 * Extract idempotency key from request headers.
 */
export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get(IDEMPOTENCY_HEADER);
}
