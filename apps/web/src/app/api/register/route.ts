import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSlug, makeSlugUnique } from "@/lib/utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const registerSchema = z.object({
  restaurantName: z.string().min(1, "Restaurant name is required").max(100),
  ownerName: z.string().min(1, "Your name is required").max(100),
  email: z.string().email("Valid email is required").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(100)
});

export async function POST(req: NextRequest) {
  // Rate limit: 5 registrations per hour per IP
  const limited = checkRateLimit(req, 5, 3600_000);
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

    // Check if slug already taken, add suffix if needed
    const { data: existingSlug } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existingSlug) {
      slug = makeSlugUnique(slug);
    }

    // ── Hash password ──
    const passwordHash = await bcrypt.hash(password, 12);

    // ── Create restaurant ──
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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
        delivery_fee: 250, // £2.50 default in pence
        min_order_delivery: 1000, // £10 default
        min_order_collection: 0,
        estimated_delivery_mins: 45,
        estimated_collection_mins: 20,
        holiday_mode: false,
        vat_registered: false,
      })
      .select()
      .single();

    if (restaurantError) {
      console.error("Restaurant creation error:", restaurantError);
      return NextResponse.json(
        { error: "Failed to create restaurant" },
        { status: 500 }
      );
    }

    // ── Create user (owner) ──
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
      console.error("User creation error:", userError);
      // Clean up the restaurant if user creation failed
      await supabaseAdmin
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);
      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    // ── Update restaurant with owner_id ──
    await supabaseAdmin
      .from("restaurants")
      .update({ owner_id: user.id })
      .eq("id", restaurant.id);

    // ── Create subscription record ──
    await supabaseAdmin.from("subscriptions").insert({
      restaurant_id: restaurant.id,
      plan: "growth",
      status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
    });

    // ── Create default opening hours (Mon-Sun, 11am-10pm) ──
    const defaultHours = Array.from({ length: 7 }, (_, i) => ({
      restaurant_id: restaurant.id,
      day_of_week: i,
      open_time: "11:00",
      close_time: "22:00",
      is_closed: false,
    }));

    await supabaseAdmin.from("opening_hours").insert(defaultHours);

    return NextResponse.json(
      {
        message: "Account created successfully",
        restaurant: {
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
