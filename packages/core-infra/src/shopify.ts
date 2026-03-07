/**
 * Shopify webhook HMAC verification (timing-safe).
 * Use for x-shopify-hmac-sha256 header verification.
 */

import crypto from 'crypto';

export function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string
): boolean {
  if (!hmacHeader || !secret) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader, 'base64'),
      Buffer.from(computed, 'base64')
    );
  } catch {
    return false;
  }
}
