# Phase 13: Revenue & Retention Engine

**New files:** 11 | **Modified files:** 5

---

## Deployment

1. Run `supabase/migration-phase13.sql` in Supabase SQL Editor
2. Optional: Set Twilio env vars (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) for SMS campaigns
3. `npm install` (no new packages — uses Canvas API for QR poster)
4. Deploy

---

## 13.1 — Loyalty System

| Feature | Description |
|---------|-------------|
| **Loyalty programs** | `loyalty_programs` table supports stamps or points mode. Restaurant owner configures: stamps required, points per £, reward type (discount/free delivery/free item) |
| **Dashboard config** | `/dashboard/loyalty` — choose stamps vs points, set rules, preview customer card, toggle active, view analytics (cards issued, active in 30 days, rewards redeemed) |
| **Auto-earn on order** | Stripe webhook fires `PUT /api/loyalty` after order confirmed. Stamps: +1 per order. Points: floor(total/100) × points_per_pound. Auto-creates loyalty card on first order |
| **Customer progress** | Checkout page shows stamp card or points bar when email matches a loyalty card. Visual circles for stamps, progress bar for points |
| **Reward redemption** | "Redeem your reward!" button at checkout when threshold reached. Deducts stamps/points, applies discount/free delivery |

## 13.2 — Re-Order Engine

| Feature | Description |
|---------|-------------|
| **Order history** | Checkout saves order items to localStorage keyed by restaurant slug. Stores last 5 orders |
| **Order Again** | Ordering page shows "Order Again" section above menu when localStorage has a previous order. Shows items from last order with "Add all to basket" button. Checks item availability |

## 13.3 — Email Marketing

| Feature | Description |
|---------|-------------|
| **Campaign CRUD** | `/dashboard/marketing` — create campaigns with name, channel (email/SMS), subject, body. Template picker: Special Offer, New Menu, We Miss You, Custom |
| **Audience segmentation** | Filter by min orders, last order before date. Expandable to tags, spend amounts |
| **Batch send** | `/api/marketing/send` — sends emails in batches of 50 with 1s delay. Tracks sent/failed counts |
| **Campaign analytics** | Each campaign shows status (draft/sending/sent), sent count, delivery stats |

## 13.4 — QR Codes & Marketing Tools

| Feature | Description |
|---------|-------------|
| **QR code generator** | `/dashboard/qr-code` — generates QR code for restaurant ordering URL via Google Charts API |
| **Poster download** | Canvas-based A5 poster generator with restaurant name, QR code, ordering URL, and call-to-action text |
| **Link sharing** | Copy ordering link, open in new tab. Usage guide: counter, social media, Google Business, email signature |

## 13.5 — SMS Marketing

| Feature | Description |
|---------|-------------|
| **SMS campaigns** | Same marketing UI with SMS channel option. 160 char limit with counter. Sends via Twilio API |

---

## New Files (11)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase13.sql` | 72 | Loyalty, campaigns, triggers schema |
| `src/app/api/loyalty/route.ts` | 128 | Loyalty program CRUD + earn stamps/points |
| `src/app/api/loyalty/check/route.ts` | 117 | Customer loyalty check + redeem |
| `src/app/api/marketing/route.ts` | 99 | Campaign CRUD |
| `src/app/api/marketing/send/route.ts` | 131 | Batch send email/SMS campaigns |
| `src/app/api/qr-code/route.ts` | 30 | QR code URL generator |
| `src/app/dashboard/loyalty/page.tsx` | 210 | Loyalty config + preview + analytics |
| `src/app/dashboard/marketing/page.tsx` | 230 | Campaign list, create/edit modal, send |
| `src/app/dashboard/qr-code/page.tsx` | 175 | QR code + poster download + sharing guide |

## Modified Files (5)

| File | Changes |
|------|---------|
| `src/components/dashboard/Sidebar.tsx` | Added Loyalty, Marketing, QR Code nav items + imports |
| `src/app/api/webhooks/stripe/route.ts` | Added loyalty earn call after order confirmation |
| `src/app/[slug]/checkout/page.tsx` | Loyalty card display, reward redemption, localStorage save for Order Again |
| `src/app/[slug]/page.tsx` | RecentOrdersSection component — "Order Again" above menu |

---

## Exit Criteria

- [x] Loyalty stamps program configurable and earning/redeeming works
- [x] "Order Again" reloads previous order items into basket
- [x] Email campaigns sendable to segmented audiences
- [x] SMS campaigns sendable via Twilio
- [x] QR code poster downloadable from dashboard
- [x] Campaign analytics show sent/failed counts
