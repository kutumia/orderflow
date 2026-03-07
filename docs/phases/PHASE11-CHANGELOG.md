# Phase 11: Compliance, Exports & Operations

**New files:** 10 | **Modified files:** 11

---

## Deployment

1. `npm install` (new deps: recharts, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities)
2. Run `supabase/migration-phase11.sql` in Supabase SQL Editor
3. Set `CRON_SECRET` env var (any random string) for onboarding cron job
4. Add Vercel cron in `vercel.json` (already configured)
5. Deploy

---

## 11.1 — UK Compliance

| Feature | Description |
|---------|-------------|
| **VAT calculation** | Checkout API calculates VAT from restaurant.vat_rate. Stored in orders.vat_amount. Displayed in checkout totals, order detail, CSV export, receipt |
| **Allergen confirmation** | Already enforced in checkout (Phase 8). Verified still blocking without checkbox |
| **GDPR data export** | `/api/customers/gdpr-export?customer_id=xxx` — downloads JSON with all customer data + order history. "Export" button on each customer row |
| **GDPR data deletion** | `/api/customers/gdpr-delete` — anonymises name/email/phone across all orders, marks customer as GDPR-deleted. Requires owner password confirmation |
| **Refund flow** | `/api/orders/refund` — processes Stripe refund, updates order status to "refunded", stores refund_reason + refunded_at, sends customer email. "Refund" button on order cards (owner only) |

## 11.2 — Financial Exports

| Feature | Description |
|---------|-------------|
| **CSV order export** | `/api/orders/export?from=&to=` — downloads CSV with all order fields including VAT. Date range picker on reports page |
| **Recharts integration** | LineChart (daily revenue), horizontal BarChart (popular items), BarChart (hourly orders), PieChart (delivery vs collection). Replaced CSS-only charts |
| **VAT in reports** | Summary cards now show "VAT Collected" stat |

## 11.3 — Admin & Operations

| Feature | Description |
|---------|-------------|
| **Admin impersonation** | "View As" button on admin panel. Stores impersonation in sessionStorage. Red banner in dashboard: "Viewing as [name] — Exit Impersonation". All API calls use impersonated restaurant_id. Audit logged |
| **Onboarding email sequence** | Vercel cron (daily 9am): Day 0 welcome, Day 3 menu reminder, Day 7 go-live encouragement. Tracked in restaurants.onboarding_emails_sent JSONB |
| **Subscription dunning** | Already handled by Phase 9 webhook. invoice.payment_failed sends dunning email |

## 11.4 — UX Polish

| Feature | Description |
|---------|-------------|
| **Category reorder** | Up/down arrows on each category to move position. Saves sort_order via `/api/sort-order` API. Items sorted by sort_order within each category |
| **Mobile sidebar** | Hamburger menu button on mobile. Sidebar slides in as overlay with backdrop. Click outside to close |
| **Dashboard impersonation banner** | Bright red banner when admin is impersonating. "Exit Impersonation" button returns to admin panel |
| **Order reprint** | "Reprint" button on each order creates a new print job |
| **Refund UI** | Inline refund form with reason text field, confirmation button, error display |

---

## New Files (10)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase11.sql` | 50 | VAT, GDPR, onboarding, sort_order schema |
| `src/app/api/orders/export/route.ts` | 78 | CSV order export download |
| `src/app/api/orders/refund/route.ts` | 116 | Stripe refund processing |
| `src/app/api/customers/gdpr-export/route.ts` | 86 | GDPR data export JSON download |
| `src/app/api/customers/gdpr-delete/route.ts` | 85 | GDPR data anonymisation |
| `src/app/api/admin/impersonate/route.ts` | 78 | Admin impersonation start/exit |
| `src/app/api/cron/onboarding-emails/route.ts` | 147 | Automated onboarding email cron |
| `src/app/api/sort-order/route.ts` | 52 | Drag-to-reorder sort_order update |
| `vercel.json` | 7 | Cron schedule configuration |
| `PHASE11-CHANGELOG.md` | This file |

## Modified Files (11)

| File | Changes |
|------|---------|
| `src/app/dashboard/reports/page.tsx` | REWRITTEN — Recharts (Line, Bar, Pie), CSV export section, VAT stat |
| `src/app/dashboard/orders/page.tsx` | REWRITTEN — refund button + form, VAT display, reprint button |
| `src/app/admin/page.tsx` | Added "View As" impersonation button per restaurant |
| `src/app/dashboard/layout.tsx` | REWRITTEN — mobile sidebar toggle, impersonation banner |
| `src/app/dashboard/menu/page.tsx` | Category reorder arrows, sort_order support |
| `src/app/dashboard/customers/page.tsx` | GDPR export button on each customer row |
| `src/app/[slug]/checkout/page.tsx` | VAT display line in totals |
| `src/app/api/checkout/route.ts` | VAT amount calculation on order insert |
| `src/lib/receipt.ts` | VAT line on thermal receipt |
| `package.json` | Added recharts, @dnd-kit/* dependencies |
