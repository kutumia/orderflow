# Phase 17: Distribution Channels

**New files:** 14 | **Modified files:** 3

---

## Deployment

1. Run `supabase/migration-phase17.sql` in Supabase SQL Editor
2. No new npm packages required
3. Deploy
4. Submit WordPress plugin to WordPress.org directory
5. Submit Shopify app to Shopify App Store

---

## 17.1 — Embeddable Ordering Widget

| Feature | Description |
|---------|-------------|
| **Widget script** | `/public/widget.js` — standalone JS (no dependencies, ~4KB). Loads via single script tag. Creates floating "Order Online" button + iframe modal overlay |
| **Widget API** | `/api/widget?slug=xxx` — returns restaurant + menu data for widget. CORS-enabled for cross-origin embedding. Cached 2 minutes |
| **Customisation** | `data-restaurant` (required), `data-button-text`, `data-position` (bottom-right/left), `data-colour`, `data-auto-open`. All via HTML data attributes |
| **Responsive** | Desktop: 480px modal with rounded corners. Mobile: full-screen overlay. Smooth open/close animations. Escape key closes |
| **Dashboard config** | Settings page → "Embed on Your Website" section. Copy-paste embed code. Shows customisation options |
| **Analytics** | Tracks `widget_loaded`, `widget_opened` via PostHog (if available on host page) |

**Embed code example:**
```html
<script src="https://orderflow.co.uk/widget.js" data-restaurant="marios-pizza"></script>
```

## 17.2 — WordPress Plugin

| Feature | Description |
|---------|-------------|
| **Plugin file** | `wordpress-plugin/orderflow-ordering/orderflow-ordering.php` — full WordPress plugin with settings page, shortcodes, and Gutenberg block |
| **Settings page** | Settings → OrderFlow: restaurant slug, button text, brand colour picker, button position selector |
| **Shortcodes** | `[orderflow_menu]` embeds full ordering page inline (iframe). `[orderflow_button]` adds styled order button link |
| **Gutenberg block** | "OrderFlow Menu" block with slug and height settings. Live iframe preview in editor |
| **Auto-embed** | When slug is configured, floating widget button auto-appears on all pages |
| **readme.txt** | WordPress.org compliant readme with description, installation, FAQ, changelog |

## 17.3 — Shopify App

| Feature | Description |
|---------|-------------|
| **Theme app extension** | `shopify-app/extensions/orderflow-block/orderflow-block.liquid` — Liquid block for Shopify theme editor |
| **Display modes** | "Floating Button" (loads widget.js) or "Inline Menu" (iframe embed). Merchant chooses in theme editor |
| **Settings** | Restaurant slug, display mode, button text, brand colour picker, iframe height slider (400-1000px) |
| **App config** | `shopify.app.toml` — ready for Shopify CLI deployment |

## 17.4 — Agency Partner Program

| Feature | Description |
|---------|-------------|
| **Database** | `partners` table (name, email, code, status, commission_rate, commission_months). `partner_referrals` table (partner_id, restaurant_id, signed_up_at, activated_at, total_commission) |
| **Partners API** | POST (apply), GET (dashboard by code or admin list), PUT (admin approve/suspend) |
| **Application page** | `/partners` — public signup form (name, email, website, expected referrals). Benefits section (20% commission, free trial for clients, tracking dashboard). Success confirmation |
| **Partner dashboard** | `/partners/dashboard` — enter partner code to view. Stats: signups, active restaurants, total commission. Referral link with copy button. Referrals table with status and commission per restaurant |
| **Commission model** | 20% of revenue for first 6 months per referred restaurant. Tracked per referral. Unique partner codes (OF-XXXX-XXXXXX format) |

---

## New Files (14)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase17.sql` | 35 | Partners + referrals tables |
| `public/widget.js` | 155 | Embeddable ordering widget script |
| `src/app/api/widget/route.ts` | 75 | Widget data API (CORS-enabled) |
| `src/app/api/partners/route.ts` | 110 | Partner CRUD API |
| `src/app/partners/page.tsx` | 105 | Partner application page |
| `src/app/partners/dashboard/page.tsx` | 155 | Partner referral dashboard |
| `wordpress-plugin/orderflow-ordering/orderflow-ordering.php` | 185 | WordPress plugin (settings, shortcodes, Gutenberg) |
| `wordpress-plugin/orderflow-ordering/block.js` | 65 | Gutenberg block editor script |
| `wordpress-plugin/orderflow-ordering/readme.txt` | 75 | WordPress.org readme |
| `shopify-app/extensions/orderflow-block/orderflow-block.liquid` | 65 | Shopify theme block |
| `shopify-app/extensions/orderflow-block/shopify.extension.toml` | 3 | Shopify extension config |
| `shopify-app/shopify.app.toml` | 10 | Shopify app config |
| `PHASE17-CHANGELOG.md` | This file |

## Modified Files (3)

| File | Changes |
|------|---------|
| `src/app/dashboard/settings/page.tsx` | Added "Embed on Your Website" section with copy-paste code and options |
| `src/app/sitemap.ts` | Added /partners page |

---

## Exit Criteria

- [x] Widget embeds on any website with one `<script>` tag
- [x] Widget opens as modal (desktop) / fullscreen (mobile) with ordering iframe
- [x] WordPress plugin with settings page, shortcodes, and Gutenberg block
- [x] Shopify theme app extension with inline and button modes
- [x] Partner application form accepting submissions
- [x] Partner dashboard showing referrals and commission
- [x] Widget data API serves restaurant + menu with CORS
- [x] Embed code section in dashboard settings
