import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

// POST /api/auth/reset-password
export async function POST(req: NextRequest) {
  // Rate limit: 10 per hour per IP
  const limited = checkRateLimit(req, 10, 3600_000);
  if (limited) return limited;

  try {
    const body = await req.json();
    const { token, new_password } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Reset token is required" }, { status: 400 });
    }

    if (!new_password || new_password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Hash the token to find it in DB
    const tokenHash = createHash("sha256").update(token).digest("hex");

    // Find valid token
    const { data: resetToken } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .single();

    if (!resetToken) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    if (resetToken.used_at) {
      return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 });
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(new_password, 12);

    // Update password
    const { error: updateErr } = await supabaseAdmin
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", resetToken.user_id);

    if (updateErr) {
      log.error("Password update failed", { userId: resetToken.user_id, error: updateErr.message });
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    // Mark token as used
    await supabaseAdmin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetToken.id);

    log.info("Password reset successful", { userId: resetToken.user_id });

    return NextResponse.json({ message: "Password has been reset. You can now sign in." });
  } catch (err: any) {
    log.error("Reset password error", { error: err.message });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
