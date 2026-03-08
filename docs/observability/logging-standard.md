# Logging Standard
**E4-T01 / E4-T02 — Structured Logging Standard and Helpers**
Last updated: 2026-03-08 | Status: Certified

---

## Principles

1. **Structured over plain text** — All log events are JSON objects
2. **No PII in structured fields** — Email/name masked; use `***` or truncated hash
3. **Correlation IDs in every log** — Use `correlationId` for request tracing
4. **Levels have meaning** — Use the right level; don't demote errors to warns
5. **Logs are for machines first** — Designed for Datadog/Vercel log search, not humans

---

## Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Operation failed; user impacted or data integrity at risk | Payment failed, DB write error |
| `warn` | Suspicious but not breaking; needs investigation | JWT mismatch, rate limit hit, retry |
| `info` | Significant business event; audit trail | Order created, refund issued, user registered |
| `debug` | Developer diagnostic; verbose; disabled in production | SQL query params, timing measurements |

---

## Required Fields

Every structured log event MUST include:

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `level` | string | `"info"` | Set by logger; not in payload |
| `message` | string | `"Order created"` | Human-readable summary |
| `timestamp` | string | `"2026-03-08T12:00:00.000Z"` | Auto-set by logger |
| `service` | string | `"web"` | App name |

### Recommended Context Fields

| Field | Type | Example | When |
|-------|------|---------|------|
| `correlationId` | string | `"a1b2c3d4-..."` | All request logs |
| `userId` | string | `"usr_abc123"` | Authenticated routes |
| `restaurantId` | string | `"rst_xyz789"` | Tenant-scoped ops |
| `orderId` | string | `"ord_123"` | Order operations |
| `action` | string | `"checkout.create"` | Business action |
| `durationMs` | number | `142` | Performance logging |
| `error` | string | `"Payment declined"` | Error events (sanitised) |

---

## Logger Usage

```typescript
import { log } from "@/lib/logger";
import { getCorrelationId, correlationContext } from "@/lib/correlation";

// In an API route:
export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);

  log.info("Checkout started", {
    ...correlationContext(correlationId),
    restaurantId,
    itemCount: items.length,
  });

  try {
    // ... operation ...
    log.info("Checkout completed", {
      ...correlationContext(correlationId),
      orderId,
      amountPence,
      durationMs: Date.now() - start,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("Checkout failed", {
      ...correlationContext(correlationId),
      error: message,  // Sanitised — no stack trace in prod
    });
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
```

---

## PII Masking Rules

| Data | Masking Rule | Example Output |
|------|-------------|----------------|
| Email address | Show domain only | `***@gmail.com` |
| Customer name | First initial + last name | `J. Smith` |
| Phone number | Mask middle digits | `+44 7*** ***890` |
| Card number | Never log | — |
| API keys | Never log | — |
| Passwords | Never log | — |
| Delivery address | City only | `Manchester` |

---

## Audit Events (must use `log.info`)

The following events are business-critical and MUST be logged for audit:

| Event | Fields |
|-------|--------|
| User registered | `userId`, `email` (masked), `restaurantId` |
| Login succeeded | `userId`, `ip` |
| Login failed | `email` (masked), `ip`, `reason` |
| Password reset | `userId`, `ip` |
| Order created | `orderId`, `restaurantId`, `amountPence`, `correlationId` |
| Payment confirmed | `orderId`, `stripePaymentIntentId`, `amountPence` |
| Refund issued | `orderId`, `amountPence`, `userId` (issuer), `correlationId` |
| Staff created | `newUserId`, `role`, `createdBy` |
| Staff deleted | `deletedUserId`, `deletedBy` |
| Admin impersonation | `targetTenantId`, `adminId`, `timestamp` |
| API key created | `tenantId`, `keyPrefix` |
| Shopify connected | `restaurantId`, `shopDomain` |
| GDPR export | `customerId`, `requestedBy` |
| GDPR delete | `customerId`, `requestedBy` |

---

## Log Retention

| Environment | Retention | Storage |
|-------------|-----------|---------|
| Production | 90 days | Vercel Log Drains → Datadog |
| Staging | 30 days | Vercel logs |
| Development | Session only | Console |

---

## Vercel Log Drain Configuration

```
Integration: Datadog Log Management
Format: JSON
Filter: All log levels
Endpoint: https://http-intake.logs.datadoghq.com/v1/input/<API_KEY>
Source: nextjs
Service: orderflow-web
```

> **Certification:** Logging standard reviewed 2026-03-08. All production routes use structured logger. PII masking verified in checkout and auth routes.
