import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwner } from "@/lib/guard";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { audit, AUDIT_ACTIONS } from "@/lib/audit-logger";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// GET /api/staff — list all staff for this restaurant
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, email, name, role, last_login_at, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/staff — invite new staff member
export async function POST(req: NextRequest) {
  const limited = await checkRateLimitAsync(req, "mutation");
  if (limited) return limited;

  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();
  const { email, name, role } = body;

  if (!email?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const validRoles = ["owner", "staff"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if email already exists
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
  }

  const tempPassword = randomBytes(6).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      password_hash: passwordHash,
      restaurant_id: restaurantId,
      role,
    })
    .select("id, email, name, role, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit: staff creation is a security-sensitive event
  await audit(req, {
    actor: guard.user.id,
    tenant: restaurantId,
    action: AUDIT_ACTIONS.STAFF_CREATED,
    target_type: "user",
    target_id: data.id,
    result: "success",
    metadata: { role, email_domain: email.split("@")[1] },
  });

  return NextResponse.json({ ...data, temp_password: tempPassword }, { status: 201 });
}

// PUT /api/staff — update staff role
export async function PUT(req: NextRequest) {
  const limited = await checkRateLimitAsync(req, "mutation");
  if (limited) return limited;

  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId, user } = guard;

  const body = await req.json();
  const { id, role, reset_password } = body;

  if (!id) return NextResponse.json({ error: "Staff ID required" }, { status: 400 });

  // Prevent changing own role
  if (id === user.id) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (role) {
    const validRoles = ["owner", "staff"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = role;
  }

  let tempPassword: string | null = null;
  if (reset_password) {
    tempPassword = randomBytes(6).toString("hex");
    updates.password_hash = await bcrypt.hash(tempPassword, 12);
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit: role changes and password resets are security-sensitive
  await audit(req, {
    actor: guard.user.id,
    tenant: restaurantId,
    action: AUDIT_ACTIONS.STAFF_UPDATED,
    target_type: "user",
    target_id: id,
    result: "success",
    metadata: {
      ...(role ? { new_role: role } : {}),
      password_reset: !!reset_password,
    },
  });

  return NextResponse.json({ success: true, ...(tempPassword ? { temp_password: tempPassword } : {}) });
}

// DELETE /api/staff?id=xxx — remove staff member
export async function DELETE(req: NextRequest) {
  const limited = await checkRateLimitAsync(req, "mutation");
  if (limited) return limited;

  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId, user } = guard;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Staff ID required" }, { status: 400 });

  if (id === user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit: staff deletion is a security-sensitive event
  await audit(req, {
    actor: guard.user.id,
    tenant: restaurantId,
    action: AUDIT_ACTIONS.STAFF_DELETED,
    target_type: "user",
    target_id: id,
    result: "success",
  });

  return NextResponse.json({ success: true });
}
