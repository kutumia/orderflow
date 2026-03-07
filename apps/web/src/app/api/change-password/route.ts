import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";

// POST /api/change-password
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const { current_password, new_password } = body;

  if (!current_password || !new_password) {
    return NextResponse.json({ error: "Both current and new passwords are required" }, { status: 400 });
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  // Verify current password
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("password_hash")
    .eq("id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isValid = await bcrypt.compare(current_password, user.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  // Update password
  const newHash = await bcrypt.hash(new_password, 12);
  const { error } = await supabaseAdmin
    .from("users")
    .update({ password_hash: newHash })
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
