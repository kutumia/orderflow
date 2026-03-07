# OrderFlow Shopify App

## Architecture

This Shopify app uses a **hybrid architecture**:

- **Backend API routes** live in the main OrderFlow Next.js app (`/src/app/api/shopify/*`)
- **Theme extensions** are deployed via the Shopify CLI (`/extensions/orderflow-block/`)
- **Embedded app UI** is served as a static HTML page inside the Shopify admin

## Directory Structure

```
shopify-app/
├── shopify.app.toml                    # App configuration
├── extensions/
│   └── orderflow-block/
│       ├── shopify.extension.toml      # Extension config
│       └── blocks/
│           ├── orderflow-menu.liquid    # Inline menu embed block
│           └── orderflow-button.liquid  # Floating button block
├── web/
│   └── templates/
│       └── index.html                  # Embedded app UI (settings page)
├── APP_STORE_LISTING.md                # App store listing content
└── README.md                           # This file
```

## API Routes (in main Next.js app)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/shopify` | GET | OAuth install entry point (HMAC validation → consent redirect) |
| `/api/shopify/callback` | GET | OAuth callback (code → token exchange, store credentials) |
| `/api/shopify/settings` | GET/PUT | Get/set restaurant slug for a shop |
| `/api/shopify/orders` | GET/POST | Sync orders to Shopify as draft orders |
| `/api/shopify/webhooks` | POST | Handle Shopify webhooks (app/uninstalled) |

## Database Tables

- `shopify_shops` — Store credentials (shop domain, access token, linked slug)
- `shopify_nonces` — Temporary OAuth nonces for CSRF protection
- `orders.shopify_draft_order_id` — Links OrderFlow orders to Shopify draft orders

## Setup

### 1. Create Shopify App

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Create a new app
3. Set App URL: `https://orderflow.co.uk/api/shopify`
4. Set Redirect URL: `https://orderflow.co.uk/api/shopify/callback`
5. Copy API Key and API Secret

### 2. Environment Variables

```bash
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
```

### 3. Run Migration

```sql
-- Run supabase/migration-shopify.sql
```

### 4. Deploy Theme Extension

```bash
cd shopify-app
shopify app deploy
```

### 5. Submit to App Store

1. Fill in app listing using `APP_STORE_LISTING.md`
2. Add screenshots
3. Submit for review

## Theme Blocks

### OrderFlow Menu
- Embeds full ordering page as iframe
- Configurable: slug, height, corner radius, branding toggle
- Appears under "Add section" → "Food & Drink" in theme editor

### OrderFlow Button
- Loads the widget.js floating button
- Configurable: slug, button text, brand colour, position
- Appears under "Add section" → "Food & Drink" in theme editor

## Order Sync

When enabled, OrderFlow orders are synced to Shopify as draft orders:
- Line items match OrderFlow order items
- Customer name and email are linked
- Order notes include OrderFlow order number and type
- Tagged with `orderflow,synced` for easy filtering
- Delivery fee added as separate line item

## Security

- All OAuth endpoints validate Shopify HMAC signatures
- Nonces provide CSRF protection during install flow
- Webhook endpoints verify `x-shopify-hmac-sha256` header
- Access tokens are stored encrypted in the database
- Shop domain format is validated before processing
