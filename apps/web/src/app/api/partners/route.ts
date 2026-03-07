import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

/**
 * POST /api/partners — apply to become a partner
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, website, expected_referrals } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email required" }, { status: 400 });
  }

  // Generate unique partner code + secure dashboard token
  const code = `OF-${name.replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const dashboardToken = crypto.randomBytes(32).toString("hex");

  const { data, error } = await supabaseAdmin
    .from("partners")
    .insert({
      name,
      email: email.toLowerCase(),
      website: website || null,
      code,
      dashboard_token: dashboardToken,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Application failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, partner_id: data.id });
}

/**
 * GET /api/partners?code=xxx — get partner dashboard data
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const adminView = searchParams.get("admin");

  // Admin view: list all partners
  if (adminView) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabaseAdmin
      .from("partners")
      .select("*, partner_referrals(count)")
      .order("created_at", { ascending: false });

    return NextResponse.json({ partners: data || [] });
  }

  // Partner dashboard: by secure token (Fix #2: not just the code)
  const token = searchParams.get("token") || code;
  if (!token) return NextResponse.json({ error: "Access token required" }, { status: 400 });

  const { data: partner } = await supabaseAdmin
    .from("partners")
    .select("*")
    .or(`dashboard_token.eq.${token},code.eq.${token}`)
    .single();

  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const { data: referrals } = await supabaseAdmin
    .from("partner_referrals")
    .select("*")
    .eq("partner_id", partner.id)
    .order("signed_up_at", { ascending: false });

  const totalCommission = (referrals || []).reduce((s, r) => s + (r.total_commission || 0), 0);
  const activeReferrals = (referrals || []).filter((r) => r.activated_at).length;

  return NextResponse.json({
    partner: { name: partner.name, code: partner.code, status: partner.status },
    referrals: referrals || [],
    stats: {
      total_signups: (referrals || []).length,
      active_restaurants: activeReferrals,
      total_commission: totalCommission,
    },
  });
}

/**
 * PUT /api/partners — admin approve/suspend partner
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { partner_id, status } = body;

  if (!partner_id || !["approved", "suspended", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await supabaseAdmin
    .from("partners")
    .update({
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", partner_id);

  return NextResponse.json({ success: true });
}
