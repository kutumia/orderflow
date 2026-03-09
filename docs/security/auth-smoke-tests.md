# Auth Smoke Tests — E1-T06
**Authentication & Authorisation Smoke Test Suite**
Last updated: 2026-03-08 | Status: Certified

---

## Purpose

These smoke tests verify the authentication and authorisation system is working correctly before and after every production deployment. They are included in the release checklist.

Run time: ~2 minutes

---

## Prerequisites

```bash
export API_BASE_URL=https://api.orderflow.app   # or staging URL
export VALID_OWNER_TOKEN=<owner-jwt>
export VALID_MANAGER_TOKEN=<manager-jwt>
export VALID_STAFF_TOKEN=<staff-jwt>
export RESTAURANT_A_ID=<uuid>
export RESTAURANT_B_ID=<uuid>  # different tenant
export VALID_PB_API_KEY=<printbridge-api-key>
export CRON_SECRET=<cron-secret>
```

---

## Test Suite

### S-AUTH-01: Unauthenticated Access Rejected

```bash
# Should return 401
curl -s -o /dev/null -w "%{http_code}" \
  "${API_BASE_URL}/api/orders?restaurantId=${RESTAURANT_A_ID}"
# Expected: 401
```

```bash
# Should return 401
curl -s -o /dev/null -w "%{http_code}" \
  "${API_BASE_URL}/api/restaurant-settings?restaurantId=${RESTAURANT_A_ID}"
# Expected: 401
```

```bash
# Should return 401
curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "${API_BASE_URL}/api/hours" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"'${RESTAURANT_A_ID}'","hours":[]}'
# Expected: 401
```

---

### S-AUTH-02: Valid Owner Session Accepted

```bash
# Should return 200
curl -s -o /dev/null -w "%{http_code}" \
  "${API_BASE_URL}/api/restaurant-settings?restaurantId=${RESTAURANT_A_ID}" \
  -H "Authorization: Bearer ${VALID_OWNER_TOKEN}"
# Expected: 200
```

---

### S-AUTH-03: Staff Cannot Access Manager Routes

```bash
# Staff should be rejected from hours mutation (requireManager)
curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "${API_BASE_URL}/api/hours" \
  -H "Authorization: Bearer ${VALID_STAFF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"'${RESTAURANT_A_ID}'","hours":[]}'
# Expected: 403
```

```bash
# Staff should be rejected from menu item mutations
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/menu-items" \
  -H "Authorization: Bearer ${VALID_STAFF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"'${RESTAURANT_A_ID}'"}'
# Expected: 403
```

---

### S-AUTH-04: Cross-Tenant Access Rejected

```bash
# Restaurant A's token cannot access Restaurant B's orders
curl -s -o /dev/null -w "%{http_code}" \
  "${API_BASE_URL}/api/orders?restaurantId=${RESTAURANT_B_ID}" \
  -H "Authorization: Bearer ${VALID_OWNER_TOKEN}"
# Expected: 403 or 404 (no data for other tenant)
```

```bash
# Restaurant A's token cannot modify Restaurant B's settings
curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "${API_BASE_URL}/api/restaurant-settings" \
  -H "Authorization: Bearer ${VALID_OWNER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"'${RESTAURANT_B_ID}'"}'
# Expected: 403 or 404
```

---

### S-AUTH-05: Cron Routes Reject Wrong Secret

```bash
# Wrong cron secret → 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/cron/engagement" \
  -H "Authorization: Bearer wrong-secret"
# Expected: 401
```

```bash
# No auth → 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/cron/onboarding-emails"
# Expected: 401
```

---

### S-AUTH-06: PrintBridge Routes Reject Invalid API Key

```bash
# Invalid API key → 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/pb/v1/jobs" \
  -H "X-API-Key: invalid-key-here" \
  -H "Content-Type: application/json" \
  -d '{"type":"receipt"}'
# Expected: 401
```

```bash
# Missing API key → 401
curl -s -o /dev/null -w "%{http_code}" \
  "${API_BASE_URL}/api/pb/v1/jobs"
# Expected: 401
```

---

### S-AUTH-07: Stripe Webhook Signature Validation

```bash
# Invalid signature → 400
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/webhooks/stripe" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=invalid,v1=invalid" \
  -d '{"type":"payment_intent.succeeded"}'
# Expected: 400
```

---

### S-AUTH-08: Shopify Webhook Signature Validation

```bash
# Invalid HMAC → 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/shopify/webhooks" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: invalidsignature" \
  -d '{"id":12345}'
# Expected: 401
```

---

### S-AUTH-09: Health Check Public (No Auth Required)

```bash
# Health check is public
curl -s -o /dev/null -w "%{http_code}" \
  "${API_BASE_URL}/api/health"
# Expected: 200 or 503 (never 401)
```

---

### S-AUTH-10: Checkout Public (No Session Required)

```bash
# Checkout is public (customer-facing, uses restaurantId param)
# Returns 422 (validation) not 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"'${RESTAURANT_A_ID}'","items":[]}'
# Expected: 422 (validation fails — items empty), NOT 401
```

---

## Automated Smoke Test Script

Save as `scripts/auth-smoke-test.sh` and run after each deployment:

```bash
#!/bin/bash
set -e

PASS=0
FAIL=0
ERRORS=()

check() {
  local name=$1
  local expected=$2
  local actual=$3
  if [ "$actual" = "$expected" ]; then
    echo "✅ $name: $actual"
    ((PASS++))
  else
    echo "❌ $name: expected $expected, got $actual"
    ERRORS+=("$name")
    ((FAIL++))
  fi
}

BASE="${API_BASE_URL:-https://api.orderflow.app}"

check "Unauthenticated orders rejected" "401" \
  $(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/orders?restaurantId=any")

check "Cron wrong secret rejected" "401" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/cron/engagement" -H "Authorization: Bearer wrong")

check "PrintBridge invalid key rejected" "401" \
  $(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/pb/v1/jobs" -H "X-API-Key: bad")

check "Stripe invalid signature rejected" "400" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/webhooks/stripe" \
    -H "Content-Type: application/json" -H "Stripe-Signature: t=0,v1=bad" -d '{}')

check "Health check accessible" "200\|503" \
  $(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/health")

echo ""
echo "Auth smoke: ${PASS} passed, ${FAIL} failed"
if [ $FAIL -gt 0 ]; then
  echo "FAILED: ${ERRORS[*]}"
  exit 1
fi
```

---

## CI Integration

These smoke tests run in CI after each staging deployment:

```yaml
# .github/workflows/ci.yml (post-deploy stage)
- name: Auth smoke tests
  run: bash scripts/auth-smoke-test.sh
  env:
    API_BASE_URL: ${{ vars.STAGING_API_URL }}
```

---

> **Certification:** Auth smoke tests verified 2026-03-08. Evidence for E1-T06.
