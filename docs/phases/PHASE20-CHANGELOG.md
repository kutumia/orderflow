# Phase 20: Enterprise Foundations

**New files:** 9 | **Modified files:** 4

---

## Deployment

1. Run `supabase/migration-phase20.sql` in Supabase SQL Editor (creates user_restaurants, menu_templates, performance_alerts tables; backfills existing user→restaurant links)
2. No new npm packages required
3. Deploy

---

## 20.1 — Multi-Location Dashboard

| Feature | Description |
|---------|-------------|
| **user_restaurants table** | Join table: user_id → restaurant_id with role (owner/manager/staff) and is_primary flag. Backfill migration copies existing user.restaurant_id links |
| **Locations API** | GET `/api/locations` — list all restaurants owned by user. PUT — switch active restaurant (updates users.restaurant_id). POST — add new location (Pro plan required, optional menu clone from existing location) |
| **Restaurant switcher** | `RestaurantSwitcher` component — replaces static name in sidebar. Single location = static display. Multi-location = dropdown with all locations, current indicator, "Add Location" button. Switching triggers full page reload to refresh session context |
| **Multi-location banner** | Dashboard homepage shows banner when user has 2+ locations: location count, current location name, link to Franchise Overview |
| **Add location flow** | Modal: name, slug, address, postcode, "Copy menu from" dropdown (existing locations). Creates restaurant, links to user, optionally clones full menu (categories + items) |

## 20.2 — Central Menu Management

| Feature | Description |
|---------|-------------|
| **Menu templates table** | `menu_templates` (owner_user_id, name, source_restaurant_id, template_data JSONB with full category/item structure) |
| **Templates API** | GET `/api/menu-templates` — list user's templates with category/item counts. POST — save current menu as template. PUT — apply template to target restaurant (creates categories + items) |
| **Franchise page UI** | "Save Current Menu" button → saves template. Template list shows name, counts. "Apply" button applies to selected restaurant |
| **Menu clone** | When adding location, "Copy menu from" clones categories + items from source restaurant. Independent pricing per location |
| **Menu sync** | `synced_with_restaurant_id` column on restaurants — foundation for future auto-sync feature |

## 20.3 — Franchise Analytics

| Feature | Description |
|---------|-------------|
| **Franchise dashboard** | `/dashboard/franchise` — locations grid (name, slug, status, address, switch button). Current location highlighted. Add location button + modal |
| **Performance alerts table** | `performance_alerts` (restaurant_id, alert_type, message, acknowledged) — foundation for automated alerts |
| **Sidebar nav** | Added "Referrals" and "Franchise" nav items with Share2 and Building2 icons |
| **Multi-location tips** | Contextual tips for multi-location users (switcher, templates, separate Stripe, per-location reports) |

---

## New Files (9)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase20.sql` | 65 | user_restaurants, menu_templates, performance_alerts tables |
| `src/app/api/locations/route.ts` | 145 | Multi-location CRUD + menu clone |
| `src/app/api/menu-templates/route.ts` | 143 | Menu template save/list/apply |
| `src/components/dashboard/RestaurantSwitcher.tsx` | 130 | Sidebar restaurant dropdown switcher |
| `src/app/dashboard/franchise/page.tsx` | 206 | Franchise overview + add location modal + templates |
| `PHASE20-CHANGELOG.md` | This file |

## Modified Files (4)

| File | Changes |
|------|---------|
| `src/components/dashboard/Sidebar.tsx` | RestaurantSwitcher replaces static name header. Added Referrals + Franchise nav items. Added Share2, Building2 icons |
| `src/app/dashboard/page.tsx` | Multi-location banner when 2+ locations. Fetches locations list |

---

## Exit Criteria

- [x] user_restaurants join table supports multi-location ownership
- [x] Locations API: list, switch, add with optional menu clone
- [x] Restaurant switcher dropdown in sidebar (multi-location users)
- [x] Add location modal with slug, address, menu clone option
- [x] Menu templates: save current menu, list templates, apply to other locations
- [x] Franchise dashboard with location grid and status indicators
- [x] Multi-location banner on dashboard homepage
- [x] Performance alerts table created (foundation for automated alerts)
- [x] Menu sync column added (foundation for auto-sync)
- [x] Referrals + Franchise added to sidebar navigation
