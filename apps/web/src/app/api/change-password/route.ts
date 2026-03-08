import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";

// POST /api/change-password
export async function POST(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const body = await req.json();
  const { current_password, new_password } = body;

  if (!current_password || !new_password) {
    return NextResponse.json({ error: "Both current and new passwords are required" }, { status: 400 });
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  // Verify current password
  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("password_hash")
    .eq("id", user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isValid = await bcrypt.compare(current_password, dbUser.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  // Update password
  const newHash = await bcrypt.hash(new_password, 12);
  const { error } = await supabaseAdmin
    .from("users")
    .update({ password_hash: newHash })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
