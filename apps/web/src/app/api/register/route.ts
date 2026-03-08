import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSlug, makeSlugUnique } from "@/lib/utils";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { z } from "zod";

const registerSchema = z.object({
  restaurantName: z.string().min(1, "Restaurant name is required").max(100),
  ownerName: z.string().min(1, "Your name is required").max(100),
  email: z.string().email("Valid email is required").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export async function POST(req: NextRequest) {
  // Rate limit: 5 registrations per hour per IP
  const limited = await checkRateLimitAsync(req, "register");
  if (limited) return limited;

  try {
    const body = await req.json();
    const parseResult = registerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const { restaurantName, ownerName, email, password } = parseResult.data;

    // ── Check for existing user ──
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // ── Generate unique slug ──
    let slug = generateSlug(restaurantName);
    const { data: existingSlug } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .single();
    if (existingSlug) slug = makeSlugUnique(slug);

    // ── Hash password ──
    const passwordHash = await bcrypt.hash(password, 12);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // ── Atomic creation via stored procedure (single DB transaction) ──
    // Falls back to sequential inserts if the RPC isn't deployed yet.
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "create_restaurant_with_owner",
      {
        p_restaurant_name: restaurantName.trim(),
        p_slug: slug,
        p_owner_name: ownerName.trim(),
        p_owner_email: email,
        p_password_hash: passwordHash,
        p_trial_ends_at: trialEndsAt.toISOString(),
      }
    );

    if (rpcError) {
      // If the stored procedure hasn't been deployed yet, fall back gracefully
      if (rpcError.code === "42883") {
        log.warn("create_restaurant_with_owner RPC not found, using sequential fallback");
        return await registerFallback(restaurantName, ownerName, email, passwordHash, slug, trialEndsAt);
      }
      log.error("Registration RPC failed", { error: rpcError.message });
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    const result = rpcResult as { restaurant_id: string; user_id: string };
    log.info("Restaurant registered", { restaurantId: result.restaurant_id, slug });

    return NextResponse.json(
      {
        message: "Account created successfully",
        restaurant: { id: result.restaurant_id, slug, name: restaurantName.trim() },
      },
      { status: 201 }
    );
  } catch (err: any) {
    log.error("Registration error", { error: err.message, stack: err.stack });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Fallback: sequential inserts with best-effort cleanup on failure.
 * Used when the stored procedure hasn't been deployed yet.
 */
async function registerFallback(
  restaurantName: string,
  ownerName: string,
  email: string,
  passwordHash: string,
  slug: string,
  trialEndsAt: Date
): Promise<NextResponse> {
  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from("restaurants")
    .insert({
      name: restaurantName.trim(),
      slug,
      is_active: true,
      subscription_status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
      delivery_enabled: true,
      collection_enabled: true,
      delivery_fee: 250,
      min_order_delivery: 1000,
      min_order_collection: 0,
      estimated_delivery_mins: 45,
      estimated_collection_mins: 20,
      holiday_mode: false,
      vat_registered: false,
    })
    .select()
    .single();

  if (restaurantError) {
    log.error("Restaurant creation error", { error: restaurantError.message });
    return NextResponse.json({ error: "Failed to create restaurant" }, { status: 500 });
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .insert({
      email: email.toLowerCase().trim(),
      name: ownerName.trim(),
      password_hash: passwordHash,
      restaurant_id: restaurant.id,
      role: "owner",
    })
    .select()
    .single();

  if (userError) {
    log.error("User creation error", { error: userError.message, restaurantId: restaurant.id });
    await supabaseAdmin.from("restaurants").delete().eq("id", restaurant.id);
    return NextResponse.json({ error: "Failed to create user account" }, { status: 500 });
  }

  await Promise.all([
    supabaseAdmin.from("restaurants").update({ owner_id: user.id }).eq("id", restaurant.id),
    supabaseAdmin.from("subscriptions").insert({
      restaurant_id: restaurant.id,
      plan: "growth",
      status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
    }),
    supabaseAdmin.from("opening_hours").insert(
      Array.from({ length: 7 }, (_, i) => ({
        restaurant_id: restaurant.id,
        day_of_week: i,
        open_time: "11:00",
        close_time: "22:00",
        is_closed: false,
      }))
    ),
  ]);

  log.info("Restaurant registered via fallback path", { restaurantId: restaurant.id, slug });
  return NextResponse.json(
    {
      message: "Account created successfully",
      restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
    },
    { status: 201 }
  );
}
