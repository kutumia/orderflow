import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

/**
 * GET /api/referrals — get restaurant's referral code + stats
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  // Get or create referral code
  let { data: code } = await supabaseAdmin
    .from("referral_codes")
    .select("*")
    .eq("restaurant_id", user.restaurant_id)
    .single();

  if (!code) {
    const newCode = `REF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const { data } = await supabaseAdmin
      .from("referral_codes")
      .insert({ restaurant_id: user.restaurant_id, code: newCode })
      .select()
      .single();
    code = data;
  }

  // Get signups
  const { data: signups } = await supabaseAdmin
    .from("referral_signups")
    .select("*")
    .eq("referrer_restaurant_id", user.restaurant_id)
    .order("signed_up_at", { ascending: false });

  const active = (signups || []).filter((s) => s.activated_at).length;
  const rewarded = (signups || []).filter((s) => s.referrer_rewarded).length;

  return NextResponse.json({
    code: code?.code,
    referral_url: `${process.env.NEXTAUTH_URL || "https://orderflow.co.uk"}/register?ref=${code?.code}`,
    stats: {
      total_signups: (signups || []).length,
      active: active,
      rewards_earned: rewarded,
    },
    signups: (signups || []).map((s) => ({
      email: s.referred_email,
      signed_up_at: s.signed_up_at,
      activated: !!s.activated_at,
      rewarded: s.referrer_rewarded,
    })),
  });
}
