/**
 * Tests for Shopify webhook HMAC verification (from @orderflow/core-infra).
 */
import crypto from 'crypto';
import { verifyShopifyHmac } from '@orderflow/core-infra';

function computeHmac(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
}

describe('verifyShopifyHmac', () => {
  const secret = 'test-webhook-secret';
  const rawBody = '{"id":12345,"order_number":"#1001"}';

  it('returns true when HMAC matches', () => {
    const hmac = computeHmac(rawBody, secret);
    expect(verifyShopifyHmac(rawBody, hmac, secret)).toBe(true);
  });

  it('returns false when HMAC is wrong', () => {
    const wrongHmac = computeHmac('other-body', secret);
    expect(verifyShopifyHmac(rawBody, wrongHmac, secret)).toBe(false);
  });

  it('returns false when secret is wrong', () => {
    const hmac = computeHmac(rawBody, secret);
    expect(verifyShopifyHmac(rawBody, hmac, 'wrong-secret')).toBe(false);
  });

  it('returns false when hmacHeader is null', () => {
    expect(verifyShopifyHmac(rawBody, null, secret)).toBe(false);
  });

  it('returns false when secret is empty', () => {
    const hmac = computeHmac(rawBody, secret);
    expect(verifyShopifyHmac(rawBody, hmac, '')).toBe(false);
  });
});
