import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { log } from "@/lib/logger";
import { randomBytes, createHash } from "crypto";

// POST /api/auth/forgot-password
export async function POST(req: NextRequest) {
  // Strict rate limit: 3 per hour per IP
  const limited = await checkRateLimitAsync(req, "passwordReset");
  if (limited) return limited;

  try {
    const body = await req.json();
    const { email } = body;

    const emailErr = validateEmail(email);
    if (emailErr) {
      return NextResponse.json({ error: emailErr }, { status: 400 });
    }

    const normalised = email.toLowerCase().trim();

    // Always return success (don't leak whether email exists)
    const successResponse = NextResponse.json({
      message: "If an account with that email exists, a reset link has been sent.",
    });

    // Find user
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("email", normalised)
      .single();

    if (!user) {
      log.info("Password reset requested for non-existent email", { email: normalised });
      return successResponse;
    }

    // Delete any existing tokens for this user
    await supabaseAdmin
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", user.id);

    // Generate token
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await supabaseAdmin.from("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

    // Send email
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your OrderFlow password",
      html: `
        <div style="font-family:sans-serif;padding:20px;max-width:500px;margin:0 auto">
          <h2 style="color:#1B4F72">Password Reset</h2>
          <p>Hi ${user.name},</p>
          <p>You requested a password reset for your OrderFlow account.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}" 
               style="background:#1B4F72;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
              Reset My Password
            </a>
          </p>
          <p style="color:#666;font-size:13px">This link expires in 1 hour.</p>
          <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    log.info("Password reset email sent", { userId: user.id });
    return successResponse;
  } catch (err: unknown) {
    log.error("Forgot password error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
