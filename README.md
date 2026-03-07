# OrderFlow — Restaurant Online Ordering Platform

> Stop paying delivery apps 30%. Own your customers. Keep your profits.

OrderFlow is a white-label SaaS platform for UK independent restaurants. Each restaurant gets their own branded ordering website, automatic kitchen printing, and a powerful owner dashboard — for a flat monthly fee.

## Phase 1: Foundation & Authentication ✅

This phase includes:
- ✅ Next.js 14 + TypeScript + Tailwind project
- ✅ Supabase integration (full schema with 13 tables + RLS policies)
- ✅ NextAuth.js authentication (credentials provider, JWT sessions)
- ✅ Registration with auto-slug generation
- ✅ Login/logout flow
- ✅ Protected dashboard with sidebar navigation
- ✅ Multi-tenant architecture (slug-based routing)
- ✅ GDPR cookie consent banner
- ✅ Terms of Service & Privacy Policy pages
- ✅ Complete TypeScript types for all data models

## Phase 2: Menu Management & Customer Ordering Site ✅

- ✅ Full menu management dashboard (categories + items CRUD)
- ✅ Allergen picker (all 14 UK-regulated allergens per Natasha's Law)
- ✅ Image upload for menu items (Supabase Storage)
- ✅ Toggle item availability instantly (86'd items)
- ✅ Customer-facing ordering page at `/[slug]`
- ✅ Category tab navigation with smooth scrolling
- ✅ Modifier selection modal (sizes, extras, required choices)
- ✅ Shopping basket with localStorage persistence
- ✅ Basket panel with quantity controls and running total
- ✅ Opening hours management page
- ✅ Settings page with shareable ordering link + copy button
- ✅ Public restaurant API (menu, hours, open/closed status)
- ✅ All dashboard sidebar pages wired up

---

## Quick Start (15 minutes)

### Prerequisites
- Node.js 20+ installed
- A free Supabase account (supabase.com)
- Git installed

### Step 1: Install Dependencies

```bash
cd orderflow
npm install
```

### Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor** in the left sidebar
3. Copy the entire contents of `supabase/schema.sql` and paste it into the editor
4. Click **Run** — this creates all 13 tables, indexes, and RLS policies
5. Go to **Storage** in the left sidebar and create a new bucket called `menu-images` (set it to **Public**)
6. Go to **Settings → API** and copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=any-random-string-at-least-32-characters-long
```

To generate a random secret:
```bash
openssl rand -base64 32
```

### Step 4: Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the OrderFlow landing page.

### Step 5: Test It

1. Click **Start Free Trial** to register a new restaurant
2. Fill in a restaurant name, your name, email, and password
3. After registration, you'll be redirected to the dashboard
4. Log out and log back in to verify auth works
5. Try registering a second restaurant with a different email — verify RLS prevents cross-tenant access

---

## Project Structure

```
orderflow/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (providers + cookie consent)
│   │   ├── page.tsx                # Landing/marketing page
│   │   ├── login/page.tsx          # Login page
│   │   ├── register/page.tsx       # Registration with slug preview
│   │   ├── terms/page.tsx          # Terms of Service
│   │   ├── privacy/page.tsx        # Privacy Policy (GDPR)
│   │   ├── [slug]/page.tsx         # Customer ordering page (public)
│   │   ├── dashboard/
│   │   │   ├── layout.tsx          # Dashboard wrapper (auth + sidebar)
│   │   │   ├── page.tsx            # Dashboard home
│   │   │   ├── menu/page.tsx       # Menu management (categories + items)
│   │   │   ├── orders/page.tsx     # Orders (placeholder)
│   │   │   ├── kitchen/page.tsx    # Kitchen display (placeholder)
│   │   │   ├── customers/page.tsx  # Customer CRM (placeholder)
│   │   │   ├── promotions/page.tsx # Promo codes (placeholder)
│   │   │   ├── reports/page.tsx    # Finance reports (placeholder)
│   │   │   ├── hours/page.tsx      # Opening hours editor
│   │   │   ├── printer/page.tsx    # Printer setup (placeholder)
│   │   │   ├── billing/page.tsx    # Billing (placeholder)
│   │   │   └── settings/page.tsx   # Settings + ordering link
│   │   └── api/
│   │       ├── auth/[...nextauth]/ # NextAuth handler
│   │       ├── register/           # Registration endpoint
│   │       ├── categories/         # Category CRUD
│   │       ├── menu-items/         # Menu item CRUD
│   │       ├── restaurants/        # Public restaurant data
│   │       ├── hours/              # Opening hours
│   │       └── upload/             # Image upload
│   ├── components/
│   │   ├── Providers.tsx           # NextAuth SessionProvider
│   │   ├── CookieConsent.tsx       # GDPR cookie banner
│   │   ├── dashboard/
│   │   │   └── Sidebar.tsx         # Dashboard sidebar navigation
│   │   └── ordering/
│   │       ├── CartContext.tsx      # Basket state management
│   │       └── ModifierModal.tsx   # Item modifier selection
│   ├── lib/
│   │   ├── supabase.ts            # Supabase clients
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── utils.ts               # Slug generation, formatting, validation
│   │   └── allergens.ts           # UK 14 regulated allergens
│   └── types/
│       └── index.ts               # All TypeScript interfaces
├── supabase/
│   └── schema.sql                 # Complete database schema
├── middleware.ts                   # Route protection
├── .env.example                   # Environment variables template
└── README.md
```

---

## Phase 3: Checkout, Payments & Order Flow ✅

- ✅ Full checkout page with customer details, delivery/collection toggle, delivery address
- ✅ Allergen confirmation checkbox (legally required before payment)
- ✅ Promo code input with real-time validation (percentage, fixed, free delivery)
- ✅ Stripe Payment Element (card, Apple Pay, Google Pay)
- ✅ Server-side price verification (prevents client-side price tampering)
- ✅ Opening hours enforcement (blocks orders when closed)
- ✅ Minimum order validation per order type
- ✅ Stripe Connect Express onboarding for restaurants (billing page)
- ✅ Stripe webhook handler: confirms order, creates customer record, queues print job
- ✅ Order confirmation/tracking page with live status polling (15s intervals)
- ✅ Progress tracker (Confirmed → Preparing → Ready → Delivered/Collected)
- ✅ Order confirmation email to customer (Resend)
- ✅ New order notification email to restaurant
- ✅ Orders dashboard: live/completed/all tabs, auto-refresh (10s), status advancement
- ✅ Full order status workflow with valid transitions enforcement
- ✅ One-click refunds via Stripe (from orders dashboard)
- ✅ Platform fee: 1.5% automatic deduction via Stripe Connect

### Phase 3 Setup Steps

1. **Stripe**: Create account at [stripe.com](https://stripe.com), enable Connect in dashboard, copy API keys to `.env.local`
2. **Stripe CLI** (for testing webhooks locally): `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
3. **Resend**: Create account at [resend.com](https://resend.com), verify your domain, copy API key to `.env.local`
4. Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `RESEND_API_KEY` to `.env.local`

## What's Next: Phase 4

## Phase 4: Kitchen Display & Print Bridge ✅

- ✅ Full-screen Kitchen Display System at `/kitchen/[slug]`
- ✅ 3-column layout: New → Cooking → Ready (like a real KDS)
- ✅ One-tap status progression (START → READY → COLLECTED/DELIVERED)
- ✅ Audio alerts for new orders (Web Audio API beeps)
- ✅ Auto-refresh every 5 seconds
- ✅ Urgency indicators (yellow at 20min, red at 30min)
- ✅ Fullscreen mode, mute toggle
- ✅ Kitchen dashboard with KDS launcher link and live stats
- ✅ ESC/POS receipt formatter (80mm thermal printer commands)
- ✅ Plain text receipt formatter (for preview/fallback)
- ✅ Print job queue management (queued → printing → printed/failed)
- ✅ Auto-retry failed prints (up to 3 attempts)
- ✅ Printer API key generation and management
- ✅ Print bridge polling API (agent fetches jobs, reports status)
- ✅ Standalone Node.js printer bridge agent (`printer-bridge/`)
- ✅ USB thermal printer support via escpos library
- ✅ Console mode for testing without a printer
- ✅ Printer dashboard with queue stats and retry controls
- ✅ Phase 4 database migration script

### Phase 4 Setup Steps

1. **Kitchen Display**: Open `/kitchen/your-slug` on a kitchen screen or tablet
2. **Printer Bridge**: Go to Dashboard → Printer → Generate API Key
3. **Install Agent**: `cd printer-bridge && npm install`
4. **Configure**: Edit `agent.js` with your API key and server URL
5. **Test**: Run `npm start` (console mode) and place a test order
6. **Go Live**: Change `PRINT_MODE` to `"usb"`, set your printer's VID/PID
7. **Migration**: If upgrading from Phase 3, run `supabase/migrations/004_phase4_print_bridge.sql`

## Phase 5: Promotions & Restaurant Settings ✅

- ✅ Full restaurant profile editor (name, address, phone, email, description)
- ✅ Logo and banner image upload (shows on ordering page)
- ✅ Delivery & collection configuration (toggle, fees, minimums, estimated times)
- ✅ Holiday mode toggle with custom message
- ✅ VAT registration settings
- ✅ QR code generation for ordering link (downloadable PNG)
- ✅ Ordering link with copy button and live preview
- ✅ Promo code CRUD (create, toggle active/inactive, delete)
- ✅ Three promo types: percentage off, fixed amount, free delivery
- ✅ Promo settings: minimum order, expiry date, max uses
- ✅ Promo validation at checkout (reuses Phase 3 validation API)
- ✅ Dashboard home page with live stats (today's revenue, orders, customers, avg order)
- ✅ Recent orders widget on dashboard home
- ✅ Banner image display on customer ordering page

## Phase 6: Customers & Reports ✅

- ✅ Full customer list with avatar, email, phone, total spent, order count
- ✅ Search customers by name, email, or phone (debounced)
- ✅ Sortable columns: last order, total spent, order count, name, date added
- ✅ Pagination (25 per page)
- ✅ CSV export of entire customer database
- ✅ Customer tagging system (VIP, Regular, New, Allergen Alert, etc.)
- ✅ Revenue summary: total revenue, avg order, delivery vs collection, discounts, refunds
- ✅ Daily revenue bar chart with tooltips
- ✅ Popular items ranking with horizontal bar chart (top 10)
- ✅ Orders by hour of day chart (identify peak hours)
- ✅ Period selector: 7 days, 30 days, 90 days, all time
- ✅ 8 summary stat cards per period

## Phase 7: SEO, Performance & Staff Management ✅

**SEO & Discoverability:**
- ✅ Dynamic `<title>`, `<meta description>`, and keywords per restaurant
- ✅ Open Graph tags (og:title, og:description, og:image) for social sharing
- ✅ Twitter Card tags (summary_large_image when banner exists)
- ✅ Canonical URLs per restaurant page
- ✅ JSON-LD structured data (Schema.org Restaurant + OrderAction)
- ✅ Dynamic `sitemap.xml` listing all active restaurants
- ✅ `robots.txt` blocking dashboard/admin/api/kitchen from crawlers
- ✅ Enhanced root layout with viewport, theme-color, metadataBase
- ✅ `NEXT_PUBLIC_BASE_URL` env var for canonical URLs

**Performance:**
- ✅ Skeleton loading screen for restaurant ordering page (`/[slug]/loading.tsx`)
- ✅ Skeleton loading screen for dashboard (`/dashboard/loading.tsx`)
- ✅ Next.js App Router streaming with Suspense boundaries

**Staff Accounts & Roles:**
- ✅ Invite staff with auto-generated temporary password
- ✅ Two roles: **Owner** (full access) and **Staff** (orders, kitchen, menu, hours, printer only)
- ✅ Role-based middleware — staff blocked from settings, billing, reports, customers, promotions, staff management
- ✅ Role-based sidebar — owner-only pages hidden from staff
- ✅ Staff management page: invite, change role, reset password, remove
- ✅ Copyable credentials for sharing with new staff
- ✅ Change password API for all users
- ✅ Self-protection: owners cannot remove/demote themselves

## Phase 8: Production Polish ✅ (FINAL)

**Error Handling:**
- ✅ React ErrorBoundary component wrapping all pages
- ✅ Global error page (`global-error.tsx`) for unhandled exceptions
- ✅ Dashboard error page (`dashboard/error.tsx`) with retry + home buttons
- ✅ Custom 404 page (`not-found.tsx`)

**Toast Notification System:**
- ✅ ToastProvider context with success/error/warning/info methods
- ✅ Auto-dismiss after 4 seconds, manual dismiss button
- ✅ Slide-up animation, stacking, colour-coded by type
- ✅ Available via `useToast()` hook in any component

**Onboarding Wizard** (`/dashboard/onboarding`):
- ✅ Step-by-step guided setup: Menu → Hours → Payments → Go Live
- ✅ Auto-checks completion status via API
- ✅ Progress bar with completion count
- ✅ Green checkmarks for completed steps

**Stripe Subscription Billing:**
- ✅ £79/month subscription via Stripe Checkout
- ✅ Trial status with days remaining countdown
- ✅ Subscribe button creates Stripe Checkout session
- ✅ Manage Subscription links to Stripe Customer Portal
- ✅ Subscription status display (trialing, active, cancelled)
- ✅ `STRIPE_PRICE_ID` env var for Stripe product

**Admin Panel** (`/admin`):
- ✅ Platform-level dashboard (admin role only)
- ✅ Stats: total restaurants, users, orders, GMV, platform fees (1.5%)
- ✅ Searchable restaurant list with pagination
- ✅ Toggle restaurant active/inactive
- ✅ View restaurant ordering pages
- ✅ Subscription status and order count per restaurant

**Rate Limiting:**
- ✅ In-memory rate limiter (`lib/rate-limit.ts`)
- ✅ Checkout API: 10 requests/min per IP
- ✅ Registration API: 5 requests/hour per IP
- ✅ Returns 429 with Retry-After header
- ✅ Automatic store cleanup of expired entries

**Landing Page:**
- ✅ FAQ section with 6 common questions (collapsible details)

---

## 🎉 OrderFlow is Complete!

All 8 phases delivered. The platform is ready for deployment.

**Quick Start:**
1. Clone the repo and run `npm install`
2. Copy `.env.example` to `.env.local` and fill in your values
3. Run `supabase/schema.sql` against your Supabase database
4. Run `npm run dev` to start developing
5. Deploy to Vercel with `vercel deploy`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL via Supabase |
| Auth | NextAuth.js (credentials + JWT) |
| Payments | Stripe Connect Express + Payment Element |
| Email | Resend (transactional emails) |
| Printing | ESC/POS + Node.js bridge agent |
| UI | Custom components + Lucide icons |
| Hosting | Vercel (recommended) |

---

## Deployment to Vercel

1. Push your code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add your environment variables in the Vercel dashboard
4. Deploy — your app will be live in under 2 minutes

---

## Common Issues

**"Invalid email or password" on login:**
Make sure your Supabase service role key is correct in `.env.local`. The registration API uses this to create users.

**Blank page after login:**
Check that `NEXTAUTH_SECRET` is set in `.env.local`.

**"Failed to create restaurant":**
Verify the schema was run successfully in Supabase. Check the SQL Editor for any errors.

**CORS errors:**
Make sure `NEXT_PUBLIC_SUPABASE_URL` doesn't have a trailing slash.
