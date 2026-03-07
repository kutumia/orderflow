import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/marketing — list campaigns
 * POST /api/marketing — create campaign
 * PUT /api/marketing — update campaign
 * DELETE /api/marketing?id=xxx — delete campaign
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;

  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("marketing_campaigns")
    .insert({
      restaurant_id: user.restaurant_id,
      name: body.name || "Untitled Campaign",
      channel: body.channel || "email",
      subject: body.subject || "",
      body: body.body || "",
      template: body.template || "custom",
      audience_filter: body.audience_filter || {},
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const allowed: any = {};
  if (updates.name !== undefined) allowed.name = updates.name;
  if (updates.subject !== undefined) allowed.subject = updates.subject;
  if (updates.body !== undefined) allowed.body = updates.body;
  if (updates.template !== undefined) allowed.template = updates.template;
  if (updates.channel !== undefined) allowed.channel = updates.channel;
  if (updates.audience_filter !== undefined) allowed.audience_filter = updates.audience_filter;

  const { error } = await supabaseAdmin
    .from("marketing_campaigns")
    .update(allowed)
    .eq("id", id)
    .eq("restaurant_id", user.restaurant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await supabaseAdmin
    .from("marketing_campaigns")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", user.restaurant_id);

  return NextResponse.json({ success: true });
}
