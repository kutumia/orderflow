/**
 * Correlation ID utilities for request tracing.
 * E3-T03 — Distributed trace correlation across services.
 *
 * Every incoming request gets a unique correlation ID that is:
 *  1. Extracted from `X-Correlation-ID` header if provided by caller
 *  2. Generated as a new UUID if not provided
 *  3. Forwarded in all outgoing API calls and DB operations via logger context
 *  4. Returned in the response as `X-Correlation-ID` header
 *
 * Usage in API routes:
 *   const correlationId = getCorrelationId(req);
 *   // Pass to log calls:
 *   log.info("Processing checkout", { correlationId, orderId });
 *   // Return in response:
 *   return NextResponse.json(data, { headers: correlationHeaders(correlationId) });
 */

import { NextRequest } from "next/server";
import crypto from "crypto";

export const CORRELATION_HEADER = "X-Correlation-ID";

/**
 * Extract or generate a correlation ID for the request.
 * If the caller provides X-Correlation-ID, validate it and use it.
 * Otherwise, generate a new UUID v4.
 */
export function getCorrelationId(req: Request | NextRequest): string {
  const incoming = req.headers.get(CORRELATION_HEADER);
  // Accept caller-provided ID if it looks like a valid UUID or short alphanumeric
  if (incoming && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming)) {
    return incoming;
  }
  return crypto.randomUUID();
}

/**
 * Build response headers that propagate the correlation ID back to the caller.
 */
export function correlationHeaders(correlationId: string): Record<string, string> {
  return { [CORRELATION_HEADER]: correlationId };
}

/**
 * Build a log context object for structured logging with the correlation ID.
 */
export function correlationContext(correlationId: string): Record<string, string> {
  return { correlationId };
}
