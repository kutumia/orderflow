# Phase 19: Growth & Retention Loops

**New files:** 7 | **Modified files:** 5

---

## Deployment

1. Run `supabase/migration-phase19.sql` in Supabase SQL Editor
2. Set env var: `CRON_SECRET` (any random string — used to auth cron endpoint)
3. Deploy (vercel.json adds daily 10am cron for engagement triggers)

---

## 19.1 — Referral Program

| Feature | Description |
|---------|-------------|
| **Referral codes table** | `referral_codes` (restaurant_id, code, uses). `referral_signups` (code, referrer, referred, signed_up_at, activated_at, rewards applied) |
| **Referrals API** | GET `/api/referrals` — auto-generates unique referral code (REF-XXXXXXXX), returns code, referral URL, stats (signups, active, rewards earned), signups list |
| **Dashboard page** | `/dashboard/referrals` — how it works (3-step visual), stats cards, referral link with copy button, share buttons (WhatsApp, Email, native Share), referral code display, signups table with status/reward tracking |
| **Rewards model** | Referrer gets 1 free month when referred restaurant completes first paid month. Referred gets 50% off first month |

## 19.2 — Automated Engagement Triggers

| Feature | Description |
|---------|-------------|
| **Trigger engine** | POST `/api/cron/engagement` — Vercel Cron at 10am daily. Processes all active Growth+ restaurants. Auth via CRON_SECRET |
| **"We miss you"** | Customers with no order in 14+ days. Auto-generates one-time 10% promo code (7-day expiry). Personalised email with promo code and order CTA. Max 50 per restaurant per run. Won't re-send within 30 days |
| **"Loyalty ready"** | Customers with full stamp cards. Email: "You've earned [reward]! Order now to redeem." Won't re-notify within 7 days |
| **Reorder reminders** | Customers overdue by 50%+ of their average frequency. Email with "Order Again" CTA. Won't re-send within 14 days |
| **Weekly digest** | Mondays only. Owner email: orders (this vs last week), revenue with % change, new customers. "View Full Report" CTA |
| **Automation logs** | `automation_logs` table tracks every trigger: type, customer, channel, promo code, status. Prevents duplicate sends |
| **All emails** | Include signed unsubscribe links. Respect marketing_opt_out. Capped at 50 customers per trigger per restaurant |

## 19.3 — Smart Reorder Reminders

| Feature | Description |
|---------|-------------|
| **Frequency tracking** | `avg_order_frequency_days` + `last_reminder_sent_at` on customers table |
| **Trigger logic** | If days since last order > 1.5× average frequency → send reminder |
| **Email** | "Ready to order again? Your usual from {restaurant} is one tap away" with deep link |

## 19.4 — QR Reorder Ecosystem

| Feature | Description |
|---------|-------------|
| **Table QR API** | GET `/api/table-qr?tables=20` — generates per-table QR codes (Google Charts API). Each links to `/{slug}?table=N&type=dine_in` |
| **Table QR UI** | Added to `/dashboard/qr-code` page — number input, generate button, grid of QR codes per table with download links |
| **Dine-in order type** | New "Dine In" option in checkout alongside Delivery/Collection. Table number input field. No delivery fee for dine-in. `table_number` column added to orders |
| **table_number on orders** | New `INTEGER` column for dine-in table tracking |

---

## New Files (7)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase19.sql` | 62 | Referrals, automation logs, customer frequency, table_number |
| `src/app/api/referrals/route.ts` | 57 | Referral code generation + stats |
| `src/app/dashboard/referrals/page.tsx` | 152 | Referral dashboard with share buttons |
| `src/app/api/cron/engagement/route.ts` | 280 | Engagement trigger engine (4 triggers + 4 email templates) |
| `src/app/api/table-qr/route.ts` | 38 | Table QR code generator |
| `PHASE19-CHANGELOG.md` | This file |

## Modified Files (5)

| File | Changes |
|------|---------|
| `src/app/dashboard/qr-code/page.tsx` | Added Table QR section (generate per-table QR codes) |
| `src/app/[slug]/checkout/page.tsx` | Added dine-in order type, table number input, table_number in payload |
| `vercel.json` | Added daily 10am engagement cron |

---

## Exit Criteria

- [x] Referral program with unique codes and tracking dashboard
- [x] Share buttons (WhatsApp, Email, native Share)
- [x] "We miss you" emails with auto-generated promo codes
- [x] Loyalty-ready email notifications
- [x] Reorder reminders based on customer frequency
- [x] Owner weekly digest email (Mondays)
- [x] Automation logs prevent duplicate sends
- [x] All automated emails include signed unsubscribe
- [x] Table QR codes generated per table number
- [x] Dine-in order type with table number field
- [x] Vercel Cron configured for daily engagement processing
