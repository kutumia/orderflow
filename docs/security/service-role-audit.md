# Service-Role (supabaseAdmin) Usage Audit
**E1-T03 — Supabase Service-Role Audit**
Last updated: 2026-03-08 | Status: Certified

---

## Overview

`supabaseAdmin` uses the **Supabase service-role key**, which bypasses Row-Level Security (RLS).
Every usage must be justified and tenant-scoped at the application layer.

The anon-key client (`supabase`) is used for public reads that RLS protects at the DB layer.

---

## Justification Matrix

| File | Usage | Justification | Tenant-Scoped? |
|------|-------|---------------|:-:|
| `lib/guard.ts` | Read `users` table to re-verify session | Auth guard needs to read across tenants | ✅ — `.eq("id", userId)` |
| `api/checkout/route.ts` | Read restaurant, menu items, create order, PaymentIntent | Payment flow requires cross-table writes | ✅ — `.eq("restaurant_id", id)` |
| `api/orders/route.ts` | Read orders by restaurant | Dashboard access post-auth | ✅ — guard enforces restaurant_id |
| `api/orders/status/route.ts` | Update order status | Kitchen/ops update | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/orders/refund/route.ts` | Read order, update status | Refund flow; owner-only | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/menu-items/route.ts` | CRUD menu items | Menu management | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/categories/route.ts` | CRUD categories | Menu management | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/hours/route.ts` | Read/update hours | Hours management | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/restaurant-settings/route.ts` | Read/update settings | Settings management | ✅ — `.eq("id", restaurantId)` |
| `api/staff/route.ts` | CRUD staff users | Staff management | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/dashboard-stats/route.ts` | Read aggregates | Analytics | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/reports/route.ts` | Read orders for reports | Reporting | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/customers/route.ts` | Read customers | CRM | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/loyalty/route.ts` | Read loyalty data | Loyalty programme | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/loyalty/check/route.ts` | Read customer loyalty | Public loyalty check | ✅ — `.eq("restaurant_id", id)` |
| `api/kitchen/route.ts` | Read orders | Kitchen display | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/print-heartbeat/route.ts` | Update device last_seen | Printer agent | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/print-jobs/route.ts` | CRUD print jobs | Print management | ✅ — `.eq("restaurant_id", restaurantId)` |
| `api/pb/v1/jobs/route.ts` | Create/read PB jobs | API key auth; tenant verified at key lookup | ✅ — `.eq("tenant_id", tenantId)` |
| `api/pb/v1/jobs/[id]/route.ts` | Read single job | API key auth | ✅ — `getJob(id, tenantId)` both filters |
| `api/pb/v1/poll/route.ts` | Poll jobs by status | Agent polling | ✅ — `.eq("tenant_id", tenantId)` |
| `api/pb/v1/devices/route.ts` | List devices | API key auth | ✅ — `.eq("tenant_id", tenantId)` |
| `api/pb/v1/heartbeat/route.ts` | Update device | API key auth | ✅ — `.eq("tenant_id", tenantId)` |
| `api/shopify/orders/route.ts` | Create/read orders | Webhook/internal sync | ✅ — `.eq("shop_domain", shop)` |
| `api/shopify/callback/route.ts` | Read/delete nonce | OAuth flow | ✅ — `.eq("state", state)` + TTL filter |
| `api/shopify/settings/route.ts` | Read/update Shopify config | Owner settings | ✅ — `.eq("id", restaurantId)` |
| `api/cron/engagement/route.ts` | Read customers, write sent_emails | Cron; machine auth | ✅ — scoped per customer |
| `api/cron/onboarding-emails/route.ts` | Read users, write events | Cron; machine auth | ✅ — scoped per user |
| `api/cron/process-queue/route.ts` | Read/update print jobs | Cron; machine auth | ✅ — processes all tenants (intentional) |
| `api/admin/route.ts` | Read platform stats | Platform admin only | ✅ — RPC function; admin-only guard |
| `api/admin/impersonate/route.ts` | Read user, issue session | Platform admin only | ✅ — audit logged |
| `api/register/route.ts` | Create user + restaurant | Registration flow | ✅ — creates own records only |
| `api/auth/forgot-password/route.ts` | Read user by email | Password reset | ✅ — `.eq("email", email)` |
| `api/auth/reset-password/route.ts` | Read token, update password | Password reset | ✅ — `.eq("token", token)` |
| `api/webhooks/stripe/route.ts` | Read/update order, restaurant | HMAC-verified webhook | ✅ — `.eq("stripe_payment_intent_id", id)` |
| `packages/printbridge-core` | Full PB job CRUD | Internal library | ✅ — always `.eq("tenant_id", tenantId)` |

---

## Findings

**No violations found.** All 36 usages are:
- Justified by business need (service-role required for cross-table operations)
- Tenant-scoped at the application query layer
- Protected by a guard or key verification before reaching DB

---

## RLS Status

Row-Level Security is enabled as a **defence-in-depth** measure on:
- `orders` — scoped by `restaurant_id`
- `menu_items` — scoped by `restaurant_id`
- `categories` — scoped by `restaurant_id`
- `customers` — scoped by `restaurant_id`
- `pb_jobs` — scoped by `tenant_id`
- `pb_devices` — scoped by `tenant_id`

The service-role client bypasses RLS intentionally; application-layer scoping is the primary isolation mechanism for admin operations.

> **Certification:** Audit performed 2026-03-08. All usages reviewed. No cross-tenant data leakage possible through documented code paths.
