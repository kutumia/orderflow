import { NextRequest, NextResponse } from "next/server";
import { authenticatePB } from "@/lib/pb-auth";
import { getJob } from "@/lib/printbridge";

/**
 * GET /api/pb/v1/jobs/[id]
 * Get a single print job by ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  const job = await getJob(params.id, auth.tenant.id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
