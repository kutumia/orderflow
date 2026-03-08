#!/usr/bin/env npx ts-node
/**
 * Operator Tool: retry-print-job
 * Manually requeues a print job that is stuck in 'failed' or 'printing' state.
 *
 * Usage:
 *   npx ts-node scripts/retry-print-job.ts --job-id <pb_job_id> [--dry-run]
 *   npx ts-node scripts/retry-print-job.ts --tenant-id <tenant_id> --status failed [--dry-run]
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const jobIdArg = args.indexOf("--job-id");
const tenantIdArg = args.indexOf("--tenant-id");
const statusArg = args.indexOf("--status");

const jobId = jobIdArg !== -1 ? args[jobIdArg + 1] : null;
const tenantId = tenantIdArg !== -1 ? args[tenantIdArg + 1] : null;
const statusFilter = statusArg !== -1 ? args[statusArg + 1] : "failed";

if (!jobId && !tenantId) {
  console.error("Usage: retry-print-job.ts (--job-id <id> | --tenant-id <id> --status <status>) [--dry-run]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  let jobs: Array<{ id: string; tenant_id: string; order_id: string; status: string; attempts: number }> = [];

  if (jobId) {
    console.log(`[retry-print-job] Looking up job: ${jobId}`);
    const { data, error } = await supabase
      .from("pb_jobs")
      .select("id, tenant_id, order_id, status, attempts")
      .eq("id", jobId)
      .single();

    if (error || !data) {
      console.error("Error: Job not found", error);
      process.exit(1);
    }
    jobs = [data];
  } else {
    console.log(`[retry-print-job] Looking up ${statusFilter} jobs for tenant: ${tenantId}`);
    const { data, error } = await supabase
      .from("pb_jobs")
      .select("id, tenant_id, order_id, status, attempts")
      .eq("tenant_id", tenantId)
      .eq("status", statusFilter);

    if (error) {
      console.error("Error querying jobs:", error);
      process.exit(1);
    }
    jobs = data ?? [];
  }

  if (jobs.length === 0) {
    console.log("[retry-print-job] No matching jobs found");
    process.exit(0);
  }

  console.log(`[retry-print-job] Found ${jobs.length} job(s):`);
  for (const job of jobs) {
    console.log(`  - ${job.id} | tenant: ${job.tenant_id} | order: ${job.order_id} | status: ${job.status} | attempts: ${job.attempts}`);
  }

  if (dryRun) {
    console.log("[retry-print-job] DRY RUN — not updating. Exiting.");
    process.exit(0);
  }

  const jobIds = jobs.map((j) => j.id);
  const { error: updateError } = await supabase
    .from("pb_jobs")
    .update({
      status: "queued",
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .in("id", jobIds);

  if (updateError) {
    console.error("[retry-print-job] Failed to update jobs:", updateError);
    process.exit(1);
  }

  console.log(`[retry-print-job] Successfully requeued ${jobs.length} job(s)`);
  console.log("[retry-print-job] Jobs will be picked up on the agent's next poll cycle");
}

main().catch((err) => {
  console.error("[retry-print-job] Fatal error:", err);
  process.exit(1);
});
