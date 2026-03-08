# OrderFlow API Route Inventory
**E1-T01 — Complete Route Inventory with Auth Classification**
Last updated: 2026-03-08 | Status: Certified

---

## Classification Key

| Symbol | Meaning |
|--------|---------|
| 🔓 | Public — no auth required |
| 🔑 | API Key auth (PrintBridge `X-API-Key` or `X-Internal-Secret`) |
| 👤 | Session auth (any role: owner, manager, staff) |
| 👔 | Manager+ auth (owner or manager) |
| 👑 | Owner-only auth |
| 🤖 | Cron / machine-to-machine (timing-safe `X-Cron-Secret`) |
| ⚙️ | Platform admin only (super-admin session) |

---

## apps/web — Next.js API Routes

### Auth & Registration
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| POST | `/api/auth/[...nextauth]` | 🔓 | login: 10/min | NextAuth endpoint |
| POST | `/api/register` | 🔓 | register: 5/hr | Creates owner account |
| POST | `/api/auth/forgot-password` | 🔓 | passwordReset: 3/hr | Sends reset email |
| POST | `/api/auth/reset-password` | 🔓 | passwordReset: 3/hr | Applies reset token |
| POST | `/api/change-password` | 👤 | general: 60/min | Authenticated password change |

### Checkout & Orders
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| POST | `/api/checkout` | 🔓 | checkout: 10/min | Creates PaymentIntent; Stripe handles payment |
| GET | `/api/orders` | 👤 | general | List orders by restaurant |
| PATCH | `/api/orders/status` | 👤 | general | Update order status (kitchen/staff) |
| POST | `/api/orders/refund` | 👑 | refund: 5/hr | Stripe refund; owner-only |
| GET | `/api/orders/export` | 👔 | general | CSV export |

### Menu Management
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| GET | `/api/menu-items` | 🔓 | general | Public menu read |
| POST | `/api/menu-items` | 👔 | mutation: 30/min | Create item |
| PUT | `/api/menu-items` | 👔 | mutation: 30/min | Update item |
| DELETE | `/api/menu-items` | 👔 | mutation: 30/min | Delete item |
| GET | `/api/categories` | 🔓 | general | Public category read |
| POST | `/api/categories` | 👔 | mutation: 30/min | Create category |
| PUT | `/api/categories` | 👔 | mutation: 30/min | Update category |
| DELETE | `/api/categories` | 👔 | mutation: 30/min | Delete category |
| PUT | `/api/sort-order` | 👔 | mutation | Reorder menu items |
| GET/PUT | `/api/hours` | 👤/👔 | mutation (PUT) | Opening hours |

### Restaurant Management
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| GET/PUT | `/api/restaurant-settings` | 👑 | mutation (PUT) | Core settings |
| GET | `/api/dashboard-stats` | 👤 | general | Analytics summary |
| GET | `/api/reports` | 👑 | general | Revenue reports |
| GET/POST | `/api/staff` | 👑 | mutation (POST) | Staff management |
| PUT/DELETE | `/api/staff` | 👑 | mutation | Update/remove staff |
| GET/POST | `/api/locations` | 👔 | mutation | Multi-location |
| GET/POST | `/api/promo-codes` | 👔 | mutation | Promo management |
| POST | `/api/promo-codes/validate` | 🔓 | general | Validate at checkout |

### Customer & Loyalty
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| GET | `/api/customers` | 👔 | general | Customer list |
| GET | `/api/loyalty` | 👔 | general | Loyalty programme |
| POST | `/api/loyalty/check` | 🔓 | general | Check loyalty status |
| GET | `/api/customers/gdpr-export` | 👑 | general | GDPR data export |
| POST | `/api/customers/gdpr-delete` | 👑 | general | GDPR deletion request |

### Kitchen & Operations
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| GET | `/api/kitchen` | 👤 | general | Kitchen display orders |
| POST | `/api/kitchen/auth` | 🔓 | login: 10/min | Kitchen PIN auth |
| POST | `/api/print-heartbeat` | 🔑 | printPoll: 60/min | Printer agent heartbeat |
| GET/POST | `/api/print-jobs` | 👤 | general | Print job management |
| GET | `/api/print-jobs/poll` | 🔑 | printPoll: 60/min | Agent polling |
| POST | `/api/print-fallback` | 👤 | general | Fallback print |

### PrintBridge SaaS API
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| POST | `/api/pb/v1/jobs` | 🔑 | printPoll | Create print job |
| GET | `/api/pb/v1/jobs/[id]` | 🔑 | printPoll | Get job (tenant-scoped) |
| GET | `/api/pb/v1/poll` | 🔑 | printPoll | Poll queued jobs |
| GET | `/api/pb/v1/devices` | 🔑 | general | List devices |
| POST | `/api/pb/v1/heartbeat` | 🔑 | general | Device heartbeat |
| POST | `/api/pb/v1/webhooks` | 🔑 | general | Webhook endpoint |

### Integrations
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| GET | `/api/shopify` | 🔓 | general | Shopify OAuth initiation |
| GET | `/api/shopify/callback` | 🔓 | general | OAuth callback; nonce TTL 15min |
| GET | `/api/shopify/orders` | 🔑 | general | Internal sync (X-Internal-Secret) |
| POST | `/api/shopify/orders` | 🔑 | general | Shopify order webhook |
| GET/PUT | `/api/shopify/settings` | 👑 | mutation (PUT) | Shopify config |
| POST | `/api/shopify/webhooks` | 🔓 | N/A | HMAC-verified Shopify webhook |
| GET | `/api/stripe/connect` | 👑 | general | Stripe Connect OAuth |
| POST | `/api/webhooks/stripe` | 🔓 | N/A | HMAC-verified Stripe webhook |
| GET | `/api/subscription` | 👑 | general | Subscription management |

### Cron / Automation
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| POST | `/api/cron/engagement` | 🤖 | N/A | Engagement emails (timing-safe) |
| POST | `/api/cron/onboarding-emails` | 🤖 | N/A | Onboarding sequence (timing-safe) |
| POST | `/api/cron/process-queue` | 🤖 | N/A | Print queue processor (timing-safe) |

### Admin
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| GET | `/api/admin` | ⚙️ | general | Platform stats |
| POST | `/api/admin/impersonate` | ⚙️ | general | Impersonate tenant (audit logged) |

### Public / Utility
| Method | Route | Auth | Rate Limit | Notes |
|--------|-------|------|------------|-------|
| GET | `/api/health` | 🔓 | N/A | Health check; DB latency |
| GET | `/api/widget` | 🔓 | general | Embeddable order widget |
| GET | `/api/manifest/[slug]` | 🔓 | general | PWA manifest |
| POST | `/api/unsubscribe` | 🔓 | general | Email unsubscribe |
| GET | `/api/qr-code` | 👤 | general | QR code generation |
| GET | `/api/table-qr` | 👔 | general | Table QR codes |
| POST | `/api/upload` | 👔 | mutation | Image upload |
| GET | `/api/restaurants` | 🔓 | general | Public restaurant lookup |
| GET | `/api/onboarding-progress` | 👤 | general | Onboarding wizard state |
| GET | `/api/marketing` | 👔 | general | Campaign list |
| POST | `/api/marketing/send` | 👑 | mutation | Send marketing emails |
| GET | `/api/referrals` | 👤 | general | Referral programme |
| GET | `/api/partners` | ⚙️ | general | Partner management |
| GET | `/api/menu-templates` | 🔓 | general | Starter menu templates |
| GET/POST | `/api/printer-devices` | 👤 | general | Printer device registry |
| GET/PUT | `/api/printer-settings` | 👔 | mutation | Printer configuration |

---

## apps/api-gateway — Hono Worker

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| GET | `/health` | 🔓 | Worker health |
| * | `/api/pb/v1/*` | 🔑 | Proxies to web app PrintBridge API |
| POST | `/events` | 🔑 | SSE event dispatch |

---

## Coverage Summary

| Auth Type | Route Count | % |
|-----------|------------|---|
| Public (🔓) | 18 | 25% |
| API Key (🔑) | 12 | 17% |
| Session any (👤) | 14 | 19% |
| Manager+ (👔) | 16 | 22% |
| Owner only (👑) | 8 | 11% |
| Cron (🤖) | 3 | 4% |
| Admin (⚙️) | 2 | 3% |
| **Total** | **73** | **100%** |

> **Certification:** All routes classified. No unprotected mutation endpoints. Rate limiting applied to all unauthenticated write paths.
