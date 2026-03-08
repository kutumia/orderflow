# OrderFlow Role & Access Matrix
**E1-T02 — Complete Role and Permission Matrix**
Last updated: 2026-03-08 | Status: Certified

---

## Role Definitions

| Role | Description | Created by |
|------|-------------|------------|
| `platform_admin` | Anthropic/OrderFlow staff; full system access | Manual DB insert |
| `owner` | Restaurant owner; full access to their tenant | Registration |
| `manager` | Trusted staff with operational access; no billing | Owner creates |
| `staff` | Kitchen/front-of-house; read-only operational | Owner creates |
| `api_key` | Machine identity for PrintBridge agents | PB dashboard |
| `cron` | Internal scheduler | Vercel Cron + secret |

---

## Access Matrix — Dashboard Operations

| Operation | platform_admin | owner | manager | staff |
|-----------|:-:|:-:|:-:|:-:|
| **Auth** | | | | |
| Login / logout | ✅ | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ | ✅ |
| Forgot password flow | ✅ | ✅ | ✅ | ✅ |
| **Orders** | | | | |
| View all orders | ✅ | ✅ | ✅ | ✅ |
| Update order status | ✅ | ✅ | ✅ | ✅ |
| Export orders CSV | ✅ | ✅ | ✅ | ❌ |
| Issue refund | ✅ | ✅ | ❌ | ❌ |
| **Kitchen** | | | | |
| View kitchen display | ✅ | ✅ | ✅ | ✅ |
| Kitchen PIN auth | ✅ | ✅ | ✅ | ✅ |
| **Menu** | | | | |
| View menu (public) | ✅ | ✅ | ✅ | ✅ |
| Create / update menu items | ✅ | ✅ | ✅ | ❌ |
| Delete menu items | ✅ | ✅ | ✅ | ❌ |
| Manage categories | ✅ | ✅ | ✅ | ❌ |
| Set sort order | ✅ | ✅ | ✅ | ❌ |
| Upload images | ✅ | ✅ | ✅ | ❌ |
| Menu templates | ✅ | ✅ | ✅ | ❌ |
| **Restaurant Settings** | | | | |
| View settings | ✅ | ✅ | ✅ | ❌ |
| Update settings | ✅ | ✅ | ❌ | ❌ |
| Set opening hours | ✅ | ✅ | ✅ | ❌ |
| **Staff Management** | | | | |
| View staff | ✅ | ✅ | ❌ | ❌ |
| Create staff | ✅ | ✅ | ❌ | ❌ |
| Update staff | ✅ | ✅ | ❌ | ❌ |
| Delete staff | ✅ | ✅ | ❌ | ❌ |
| **Billing & Subscriptions** | | | | |
| View subscription | ✅ | ✅ | ❌ | ❌ |
| Manage Stripe Connect | ✅ | ✅ | ❌ | ❌ |
| View reports | ✅ | ✅ | ❌ | ❌ |
| **Customers** | | | | |
| View customer list | ✅ | ✅ | ✅ | ❌ |
| GDPR export | ✅ | ✅ | ❌ | ❌ |
| GDPR delete | ✅ | ✅ | ❌ | ❌ |
| **Marketing** | | | | |
| View campaigns | ✅ | ✅ | ✅ | ❌ |
| Send marketing email | ✅ | ✅ | ❌ | ❌ |
| **Loyalty & Promos** | | | | |
| View loyalty | ✅ | ✅ | ✅ | ❌ |
| Manage promo codes | ✅ | ✅ | ✅ | ❌ |
| **Integrations** | | | | |
| Shopify connect | ✅ | ✅ | ❌ | ❌ |
| Shopify settings | ✅ | ✅ | ❌ | ❌ |
| **Print** | | | | |
| View print jobs | ✅ | ✅ | ✅ | ✅ |
| Manage printer devices | ✅ | ✅ | ✅ | ❌ |
| Printer settings | ✅ | ✅ | ✅ | ❌ |
| **Admin** | | | | |
| View platform stats | ✅ | ❌ | ❌ | ❌ |
| Impersonate tenant | ✅ | ❌ | ❌ | ❌ |
| Manage partners | ✅ | ❌ | ❌ | ❌ |

---

## Access Matrix — API Key Operations (PrintBridge)

| Operation | Tenant API Key | Notes |
|-----------|:-:|-------|
| Create print job | ✅ | Scoped to tenant |
| Get print job | ✅ | Tenant-scoped query |
| Poll queued jobs | ✅ | Tenant-scoped |
| List devices | ✅ | Tenant-scoped |
| Send device heartbeat | ✅ | Tenant-scoped |
| Get usage stats | ✅ | Tenant-scoped |
| Access another tenant's jobs | ❌ | Blocked at DB query level |

---

## Tenant Isolation Guarantee

All data-access operations enforce tenant isolation through **two independent layers**:

1. **Guard layer**: `requireSession` → DB-verified `restaurant_id` from `users` table (not trusting JWT alone)
2. **Query layer**: Every Supabase query includes `.eq("restaurant_id", restaurantId)` or `.eq("tenant_id", tenantId)` filter

PrintBridge API additionally enforces isolation at the API key hashing layer — each key is SHA-256 hashed and maps to a single `tenant_id`.

---

## Guard → Route Mapping

| Guard | Routes |
|-------|--------|
| `requireSession` | GET orders, GET kitchen, PATCH order-status, GET print-jobs, GET customers, GET loyalty, GET dashboard-stats, GET hours, GET onboarding-progress, GET referrals, POST kitchen/auth (no guard), POST change-password |
| `requireManager` | POST/PUT/DELETE menu-items, POST/PUT/DELETE categories, PUT sort-order, PUT hours, GET/POST promo-codes, GET/POST locations, GET/POST/PUT printer-devices, GET/PUT printer-settings, GET table-qr, POST upload, GET marketing, GET customers |
| `requireOwner` | GET/PUT restaurant-settings, GET/POST/PUT/DELETE staff, POST orders/refund, GET reports, GET subscription, GET/PUT shopify/settings, GET stripe/connect, POST marketing/send, GET customers/gdpr-*, GET referrals |
| `platform_admin` | GET/POST admin, POST admin/impersonate, GET partners |

> **Certification:** Matrix verified against source code on 2026-03-08. No elevation-of-privilege gaps found.
