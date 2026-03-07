# Phase 16: Self-Serve Onboarding & Help

**New files:** 8 | **Modified files:** 6

---

## Deployment

1. No new migration required (onboarding_step already exists on restaurants)
2. `npm install` (no new packages)
3. Deploy

---

## 16.1 — Onboarding Wizard Rewrite

| Feature | Description |
|---------|-------------|
| **5-step wizard** | REWRITTEN (310 lines). Step 1: Restaurant profile (name, cuisine, phone, address, postcode). Step 2: Menu setup (manual categories+items or JSON import). Step 3: Delivery settings (delivery/collection toggles, fees, hours with "Copy Monday to all"). Step 4: Stripe Connect. Step 5: Go-live checklist |
| **Progress bar** | Visual step indicator with completed/active/upcoming states. Click completed steps to go back |
| **Menu import** | JSON paste import: paste menu structure, auto-creates categories and items. Format: `[{"name":"Cat","items":[{"name":"Item","price":450}]}]` |
| **Go-live checklist** | Auto-checks: profile complete, 3+ items, hours set, Stripe connected, printer (optional). "Publish Your Restaurant" button with confetti celebration. Share ordering link with copy button |
| **State tracking** | `onboarding_step` saved on restaurant. Dashboard redirects to wizard if incomplete. "Skip for now" on payment step |

## 16.2 — Knowledge Base

| Feature | Description |
|---------|-------------|
| **15 articles** | `content/help/articles.json` — Getting Started, Menu Management, Taking Your First Order, Understanding Reports, Printer Setup, Billing & Plans, Loyalty Program, Email Marketing, QR Codes, Mobile Ordering, Opening Hours, Delivery Settings, Promo Codes, Staff Accounts, Data & Privacy |
| **Help index page** | `/help` — searchable article list with tag filtering. Tags: onboarding, dashboard, menu, orders, reports, printer, settings, billing, loyalty, marketing, etc. |
| **Article detail** | `/help/[slug]` — renders article with heading/list/bold formatting. Related articles shown at bottom based on shared tags |
| **In-app help widget** | `HelpWidget` component — "?" button in dashboard header (mobile + desktop). Slide-out panel with contextual articles (mapped by current URL path to article tags). Search bar. "Contact Support" link |

## 16.3 — Printer Setup Assistant

| Feature | Description |
|---------|-------------|
| **Setup guide** | Shows on printer page when no devices connected. 4-step numbered guide: download app, enter API key, select printer, test print |
| **Troubleshooting wizard** | "Printer not working?" link opens interactive decision tree. Covers: not printing (app running? icon colour? printer visible?), garbled output (paper width, orientation), connection issues (server, API key, crashes). Each leaf node gives specific actionable fix |

## 16.4 — WCAG 2.1 AA Compliance

| Feature | Description |
|---------|-------------|
| **Focus indicators** | Global `focus-visible` outline (2px solid brand colour). Mouse clicks don't show outlines. Keyboard navigation shows clear focus rings |
| **Touch targets** | 44x44px minimum for coarse pointer devices (buttons, links, checkboxes) |
| **Reduced motion** | `prefers-reduced-motion` media query disables animations |
| **Screen reader utilities** | `sr-only` class, `SkipLink` component, `LiveRegion` for announcements, `useFocusTrap` for modals |
| **Accessibility lib** | `src/lib/accessibility.tsx` — SkipLink, useFocusTrap, LiveRegion components |

## 16.5 — SEO & Sitemap

| Feature | Description |
|---------|-------------|
| **Schema.org** | Already implemented in Phase 14 — JSON-LD Restaurant structured data on all ordering pages |
| **Meta tags** | Already implemented — dynamic title, description, OpenGraph, Twitter cards per restaurant |
| **Sitemap updated** | Added `/pricing` (priority 0.9) and `/help` (priority 0.7) to sitemap.ts |

---

## New Files (8)

| File | Lines | Purpose |
|------|-------|---------|
| `content/help/articles.json` | 190 | 15 help articles with tags |
| `src/app/help/page.tsx` | 110 | Help centre index with search + tag filtering |
| `src/app/help/[slug]/page.tsx` | 106 | Article detail with markdown rendering + related articles |
| `src/components/dashboard/HelpWidget.tsx` | 138 | Slide-out contextual help panel |
| `src/lib/accessibility.tsx` | 79 | SkipLink, useFocusTrap, LiveRegion WCAG utilities |
| `PHASE16-CHANGELOG.md` | This file |

## Modified Files (6)

| File | Changes |
|------|---------|
| `src/app/dashboard/onboarding/page.tsx` | REWRITTEN — 5-step wizard with profile, menu import, delivery/hours, payments, go-live |
| `src/app/dashboard/printer/page.tsx` | Added setup guide (4 steps) + troubleshooting wizard (interactive decision tree) |
| `src/app/dashboard/layout.tsx` | Added HelpWidget import and placement in mobile + desktop headers |
| `src/app/globals.css` | WCAG focus-visible, sr-only, touch targets, reduced motion |
| `src/app/sitemap.ts` | Added /pricing and /help pages |

---

## Exit Criteria

- [x] New signup can go live via 5-step wizard with menu import
- [x] Menu import from JSON paste works
- [x] 15 help articles searchable from /help
- [x] In-app help widget shows contextual articles per dashboard page
- [x] Printer setup guide shows for new users
- [x] Printer troubleshooting wizard covers common issues
- [x] Focus indicators visible for keyboard navigation
- [x] 44px minimum touch targets on mobile
- [x] Reduced motion support
- [x] Schema.org structured data on ordering pages (already existed)
- [x] Sitemap includes pricing and help pages
