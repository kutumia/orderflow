# Feature Flag Policy — E6-T06
**Feature Flag Standards and Governance**
Last updated: 2026-03-08 | Status: Certified

---

## Policy Overview

Feature flags enable progressive delivery and safe rollback of new functionality without a code deployment. This policy defines when flags are required, how they are implemented, and how they are cleaned up.

---

## When Feature Flags Are Required

| Scenario | Flag Required? |
|----------|---------------|
| New customer-facing feature affecting > 10% of users | ✅ Yes |
| Database migration that changes user-visible behaviour | ✅ Yes |
| Third-party integration changes (Stripe, Shopify) | ✅ Yes |
| Internal refactor with no user-visible change | ❌ No |
| Bug fix | ❌ No |
| Documentation or config change | ❌ No |
| A/B test | ✅ Yes (dedicated experiment flag) |

---

## Implementation

### Current Implementation (Environment-Variable Flags)

Until a dedicated feature flag library is implemented (see Next Steps), flags are managed via environment variables:

```typescript
// apps/web/src/lib/feature-flags.ts
export const FLAGS = {
  LOYALTY_V2:          process.env.FLAG_LOYALTY_V2 === "true",
  SHOPIFY_SYNC_V2:     process.env.FLAG_SHOPIFY_SYNC_V2 === "true",
  PRINTBRIDGE_AUTOUPDATE: process.env.FLAG_PB_AUTOUPDATE === "true",
  NEW_CHECKOUT_FLOW:   process.env.FLAG_NEW_CHECKOUT === "true",
} as const;

// Usage:
import { FLAGS } from "@/lib/feature-flags";
if (FLAGS.LOYALTY_V2) {
  // new loyalty logic
} else {
  // existing logic
}
```

### Vercel Environment Variable Flags

Flags are set per environment:

```bash
# Enable for staging only
vercel env add FLAG_LOYALTY_V2 preview
# Value: true

# Enable for production
vercel env add FLAG_LOYALTY_V2 production
# Value: true
```

### Rollout Pattern

```
Dev → Preview (staging) → 10% of production → 50% → 100%
```

For percentage rollouts, use tenant-based splitting:
```typescript
// Deterministic per-tenant rollout (no randomness per request)
function isInRollout(restaurantId: string, percentage: number): boolean {
  const hash = parseInt(restaurantId.replace(/-/g, "").slice(0, 8), 16);
  return (hash % 100) < percentage;
}
```

---

## Flag Lifecycle

### 1. Creation

Before creating a flag:
- [ ] Document purpose and success criteria in PR description
- [ ] Set expiry date (maximum 90 days from creation)
- [ ] Add flag to `.env.example` with description
- [ ] Add flag to this document's Flag Registry

### 2. Active

During rollout:
- Monitor error rates and key metrics for flagged code path
- Keep flag off in production until staging validation is complete
- Never ship a flag that disables a critical path (checkout, auth)

### 3. Cleanup

After successful rollout:
- [ ] Remove flag check from code (make new behaviour permanent)
- [ ] Remove environment variable from all environments
- [ ] Remove from `.env.example` and this registry
- [ ] Delete the `if (FLAGS.X)` branch (remove old code path)

**Stale flag policy:** Flags older than 90 days without cleanup are flagged (pun intended) in engineering reviews as tech debt.

---

## Flag Registry

| Flag | Purpose | Created | Expires | Environments | Status |
|------|---------|---------|---------|-------------|--------|
| *(none active)* | | | | | |

---

## Governance

### Who Can Create Flags
- Any engineer can create a flag for their feature
- Engineering Lead approves flags that affect payment flows or auth

### Who Can Promote Flags to Production
- Engineering Lead approval required for production enablement
- Requires passing staging validation (smoke tests + manual QA)

### Emergency Flag-Off
To disable a feature immediately in production:
```bash
vercel env add FLAG_<NAME> production
# Value: false (or remove the variable entirely)
vercel --prod
# Redeployment takes < 30 seconds
```

---

## Next Steps

**Planned:** Implement a dedicated feature flag service (LaunchDarkly, Flagsmith, or custom Supabase-backed) in Q3 2026 to support:
- Per-tenant flag overrides (without redeployment)
- Percentage rollouts with user-level targeting
- Real-time flag evaluation without redeployment
- Audit trail of flag changes

**Timeline:** Q3 2026 (see `enterprise-scorecard.md` — Next Steps)

---

> **Certification:** Feature flag policy documented 2026-03-08. Evidence for E6-T06.
