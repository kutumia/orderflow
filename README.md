# OrderFlow Monorepo

OrderFlow is a monorepo containing customer-facing ordering, restaurant dashboards, PrintBridge SaaS, Shopify integration, and desktop print agents.

## Structure

| Path | Description |
|------|-------------|
| `apps/web` | Main Next.js app: customer ordering, restaurant dashboard, APIs |
| `apps/printbridge-web` | PrintBridge SaaS front-end and subscription checkout |
| `apps/printbridge` | Electron desktop app: printer agent (poll, print, heartbeat) |
| `apps/api-gateway` | Cloudflare Worker (Hono) API gateway |
| `apps/shopify` | Shopify app: checkout UI extension, theme blocks, webhooks |
| `packages/database` | Shared Supabase clients |
| `packages/printbridge-core` | Print job, tenant, webhook, usage logic |
| `packages/security` | Auth, rate limits, alerts, validation helpers |
| `packages/printbridge-client` | PrintBridge Node SDK (stub) |

## Prerequisites

- Node.js 18+
- npm 10+

## Quick start

```bash
# Install dependencies (all workspaces)
npm install

# Run all apps in dev (each in its own terminal or use turbo)
npm run dev

# Run a single app
npm run dev --workspace=web
npm run dev --workspace=printbridge-web
```

## Commands (root)

| Command | Description |
|---------|-------------|
| `npm run build` | Build all apps (Turborepo) |
| `npm run dev` | Start dev servers for all apps |
| `npm run lint` | Lint all workspaces |
| `npm run test` | Run tests in all workspaces |
| `npm run format` | Format code with Prettier |

## Per-app commands

- **apps/web**: `npm run dev`, `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e` (Playwright)
- **apps/printbridge-web**: `npm run dev` (port 3001), `npm run build`, `npm run lint`
- **apps/printbridge**: Electron; see `apps/printbridge/README.md`
- **apps/api-gateway**: `npm run dev`, `npm run deploy` (Wrangler)

## Environment

1. Copy `.env.example` to `.env.local` (or per-app `.env` as needed).
2. Fill in Supabase, NextAuth, Stripe, and other keys. See `.env.example` and app-specific docs.

## CI

On pull requests, CI runs:

- `npm ci`
- `npx turbo run lint typecheck test --continue`
- `npx turbo run build --filter=web --filter=printbridge-web`

See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Env and security

- **Shopify webhooks**: set `SHOPIFY_WEBHOOK_SECRET` (or `SHOPIFY_API_SECRET`) and ensure the webhook handler verifies HMAC.
- **API gateway**: set `API_GATEWAY_API_KEY` and optionally `CORS_ORIGINS` (comma-separated).
- **Stripe**: do not use placeholder keys; ensure `STRIPE_SECRET_KEY` is set in production.
