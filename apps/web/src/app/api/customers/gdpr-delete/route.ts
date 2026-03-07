import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";

/**
 * POST /api/customers/gdpr-delete
 * Body: { customer_id, owner_password }
 * Anonymises customer name/email/phone in all orders, then deletes customer record.
 * Requires owner password confirmation for safety.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const restaurantId = user.restaurant_id;
  const body = await req.json();
  const { customer_id, owner_password } = body;

  if (!customer_id || !owner_password) {
    return NextResponse.json({ error: "Customer ID and password required" }, { status: 400 });
  }

  // Verify owner password
  const { data: ownerUser } = await supabaseAdmin
    .from("users")
    .select("password_hash")
    .eq("id", user.id)
    .single();

  if (!ownerUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const passwordValid = await bcrypt.compare(owner_password, ownerUser.password_hash);
  if (!passwordValid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 403 });
  }

  // Fetch customer
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("email")
    .eq("id", customer_id)
    .eq("restaurant_id", restaurantId)
    .single();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Anonymise all orders from this customer
  await supabaseAdmin
    .from("orders")
    .update({
      customer_name: "Deleted Customer",
      customer_email: "deleted@gdpr.removed",
      customer_phone: "0000000000",
      delivery_address: null,
      notes: null,
    })
    .eq("restaurant_id", restaurantId)
    .eq("customer_email", customer.email);

  // Mark customer as GDPR-deleted, then soft delete
  await supabaseAdmin
    .from("customers")
    .update({
      name: "Deleted Customer",
      email: `deleted-${customer_id}@gdpr.removed`,
      phone: "0000000000",
      gdpr_deleted: true,
      gdpr_deleted_at: new Date().toISOString(),
    })
    .eq("id", customer_id);

  return NextResponse.json({ success: true, anonymised: true });
}
