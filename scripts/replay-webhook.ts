#!/usr/bin/env npx ts-node
/**
 * Operator Tool: replay-webhook
 * Replays a stored webhook event from the database to the webhook handler.
 *
 * Usage:
 *   npx ts-node scripts/replay-webhook.ts --event-id <webhook_event_id> [--dry-run]
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set
 *   - INTERNAL_API_SECRET env var set
 *   - API_BASE_URL env var set (e.g. http://localhost:3000)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET!;
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !INTERNAL_API_SECRET) {
  console.error("Error: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_API_SECRET must be set");
  process.exit(1);
}

const args = process.argv.slice(2);
const eventIdArg = args.indexOf("--event-id");
const dryRun = args.includes("--dry-run");

if (eventIdArg === -1 || !args[eventIdArg + 1]) {
  console.error("Usage: replay-webhook.ts --event-id <id> [--dry-run]");
  process.exit(1);
}

const eventId = args[eventIdArg + 1];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log(`[replay-webhook] Looking up event: ${eventId}`);

  const { data: event, error } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    console.error("Error: Webhook event not found", error);
    process.exit(1);
  }

  console.log(`[replay-webhook] Found event:`, {
    id: event.id,
    source: event.source,
    event_type: event.event_type,
    processed_at: event.processed_at,
    status: event.status,
  });

  if (dryRun) {
    console.log("[replay-webhook] DRY RUN — not sending. Payload:");
    console.log(JSON.stringify(event.payload, null, 2));
    process.exit(0);
  }

  const endpoint = event.source === "stripe"
    ? `${API_BASE_URL}/api/webhooks/stripe`
    : `${API_BASE_URL}/api/shopify/webhooks`;

  console.log(`[replay-webhook] Replaying to: ${endpoint}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": INTERNAL_API_SECRET,
      "X-Replay-Event-Id": eventId,
      "X-Replay-Original-Timestamp": event.created_at,
    },
    body: JSON.stringify(event.payload),
  });

  const body = await response.text();
  console.log(`[replay-webhook] Response: ${response.status} ${response.statusText}`);
  if (body) console.log("[replay-webhook] Body:", body);

  if (!response.ok) {
    console.error("[replay-webhook] Replay failed");
    process.exit(1);
  }

  console.log("[replay-webhook] Replay succeeded");
}

main().catch((err) => {
  console.error("[replay-webhook] Fatal error:", err);
  process.exit(1);
});
