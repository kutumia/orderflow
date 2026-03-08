# Data Classification Register
**E2-T01 — Data Classification and Handling Policy**
Last updated: 2026-03-08 | Status: Certified

---

## Classification Tiers

| Tier | Label | Definition | Examples |
|------|-------|------------|---------|
| T1 | **RESTRICTED** | Regulated or highly sensitive; breach triggers legal obligations | Payment card data, passwords, API keys |
| T2 | **CONFIDENTIAL** | Business-sensitive; access strictly controlled | Customer PII, order data, revenue figures |
| T3 | **INTERNAL** | Internal operational data; not for public disclosure | System logs, staff info, settings |
| T4 | **PUBLIC** | Intentionally public; no harm if disclosed | Menu items, restaurant name, opening hours |

---

## Data Asset Register

### Authentication & Identity

| Field | Table | Tier | Storage | Notes |
|-------|-------|------|---------|-------|
| `password_hash` | `users` | T1 | Supabase (bcrypt) | Never returned in API responses |
| `api_key_hash` | `pb_api_keys` | T1 | Supabase (SHA-256) | Raw key never stored |
| `reset_token` | `password_resets` | T1 | Supabase | TTL 1hr; single-use |
| `nonce` | `shopify_nonces` | T1 | Supabase | TTL 15min; single-use |
| `webhook_secret` | `pb_tenants` | T1 | Supabase | HMAC signing secret |
| `stripe_account_id` | `restaurants` | T2 | Supabase | Stripe Connect ID |
| `shopify_access_token` | `shopify_connections` | T1 | Supabase (encrypted at rest) | OAuth token |
| `user.email` | `users` | T2 | Supabase | Used for auth + comms |
| `user.name` | `users` | T2 | Supabase | PII |
| `user.role` | `users` | T3 | Supabase | Access control |

### Customer Data (GDPR Article 4)

| Field | Table | Tier | Storage | Notes |
|-------|-------|------|---------|-------|
| `customer_email` | `orders`, `customers` | T2 | Supabase | PII; GDPR export/delete |
| `customer_name` | `orders`, `customers` | T2 | Supabase | PII |
| `customer_phone` | `orders` | T2 | Supabase | PII |
| `delivery_address` | `orders` | T2 | Supabase | PII; GDPR sensitive |
| `loyalty_points` | `loyalty` | T3 | Supabase | Non-PII |

### Payment Data

| Field | Table / System | Tier | Storage | Notes |
|-------|----------------|------|---------|-------|
| Card number, CVV | Stripe | T1 | **Stripe only** | OrderFlow never sees raw card data |
| `stripe_payment_intent_id` | `orders` | T2 | Supabase | Reference only; not card data |
| `amount_pence` | `orders` | T2 | Supabase | Revenue data |
| `platform_fee_pence` | `orders` | T2 | Supabase | Commercial-in-confidence |

### Operational Data

| Field | Table | Tier | Storage | Notes |
|-------|-------|------|---------|-------|
| `receipt_data` | `pb_jobs` | T3 | Supabase | ESC/POS commands; may contain order |
| System logs | Vercel / external | T3 | Log provider | No PII in structured fields |
| Audit trail | `audit_log` | T2 | Supabase | Access-controlled |

### Public Data

| Data | Source | Tier |
|------|--------|------|
| Menu items (name, price, description) | `menu_items` | T4 |
| Categories | `categories` | T4 |
| Opening hours | `hours` | T4 |
| Restaurant name, logo, slug | `restaurants` | T4 |

---

## Handling Requirements by Tier

### T1 — RESTRICTED
- Never log raw values
- Never return in API responses
- Encrypt at rest (Supabase AES-256)
- Transmit only over TLS 1.2+
- Rotate on compromise within 4 hours
- Access: service-role + specific code paths only

### T2 — CONFIDENTIAL
- Mask in logs (use `***` for email, truncate names)
- Return only to authenticated owner of the data
- GDPR subject-access and deletion must be supported
- Retain per legal requirements (6 years for financial)

### T3 — INTERNAL
- Access restricted to authenticated staff+
- Retain per operational need (90 days for logs)

### T4 — PUBLIC
- No access controls required
- Cache-friendly
- No PII

---

## GDPR Compliance

| Obligation | Implementation |
|-----------|----------------|
| Right of access | `GET /api/customers/gdpr-export` |
| Right to erasure | `POST /api/customers/gdpr-delete` |
| Data minimisation | Only necessary fields collected at checkout |
| Consent | Allergen confirmation required; email opt-in tracked |
| Breach notification | Incident runbook: 72hr notification target |
| Retention | Orders: 7 years (tax); Customers: 3 years post-last-order |

> **Certification:** Classification reviewed 2026-03-08. All T1 data confirmed never transmitted in plaintext.
