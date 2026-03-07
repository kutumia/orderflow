import { NextRequest, NextResponse } from "next/server";
import { authenticatePB } from "@/lib/pb-auth";
import { pollJobs, updateJobStatus } from "@/lib/printbridge";

/**
 * GET /api/pb/v1/poll?device_id=xxx
 * Agent polls for queued print jobs.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id") || undefined;

  if (!auth.tenant.restaurant_id) {
    return NextResponse.json({ error: "Tenant not linked to restaurant" }, { status: 400 });
  }

  const jobs = await pollJobs({
    tenantId: auth.tenant.id,
    restaurantId: auth.tenant.restaurant_id,
    deviceId,
    limit: 10,
  });

  return NextResponse.json({ jobs });
}

/**
 * POST /api/pb/v1/poll
 * Agent reports job completion or failure.
 * Body: { job_id, status: "printed"|"failed", error_message? }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { job_id, status, error_message } = body;

  if (!job_id || !["printed", "failed", "printing"].includes(status)) {
    return NextResponse.json({ error: "job_id and valid status required" }, { status: 400 });
  }

  const job = await updateJobStatus({
    jobId: job_id,
    tenantId: auth.tenant.id,
    status,
    errorMessage: error_message,
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
