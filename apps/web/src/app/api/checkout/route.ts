import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe, calculatePlatformFee } from "@/lib/stripe";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { z } from "zod";

const checkoutSchema = z.object({
  restaurant_id: z.string().uuid("Invalid restaurant ID"),
  customer_name: z.string().min(1, "Name is required").max(100),
  customer_email: z.string().email("Invalid email").max(254),
  customer_phone: z.string().min(1, "Phone is required").max(20),
  items: z.array(z.any()).min(1, "Cart is empty").max(100, "Too many items in cart"),
  order_type: z.enum(["delivery", "collection"], { errorMap: () => ({ message: "Invalid order type" }) }),
  delivery_address: z.string().max(500).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  promo_code: z.string().max(20).optional().nullable(),
  allergen_confirmed: z.literal(true, {
    errorMap: () => ({ message: "Allergen confirmation is required" })
  })
});

// POST /api/checkout — create PaymentIntent for order
export async function POST(req: NextRequest) {
  // Rate limit: 10 checkout attempts per minute per IP
  const limited = await checkRateLimitAsync(req, "checkout");
  if (limited) return limited;

  try {
    const body = await req.json();
    const parseResult = checkoutSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const {
      restaurant_id,
      customer_name,
      customer_email,
      customer_phone,
      items,
      order_type,
      delivery_address,
      notes,
      promo_code,
      allergen_confirmed,
    } = parseResult.data;

    // ── Fetch restaurant ──
    const { data: restaurant, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("id", restaurant_id)
      .eq("is_active", true)
      .single();

    if (rErr || !restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    // ── Check trial expiry (BUG-014) ──
    if (restaurant.subscription_status === "trialing" && restaurant.trial_ends_at) {
      if (new Date(restaurant.trial_ends_at) < new Date()) {
        return NextResponse.json(
          { error: "This restaurant's trial has expired. Please contact the restaurant." },
          { status: 403 }
        );
      }
    }
    if (restaurant.subscription_status === "cancelled") {
      return NextResponse.json(
        { error: "This restaurant is not currently accepting orders" },
        { status: 403 }
      );
    }

    // ── Check if open ──
    if (restaurant.holiday_mode) {
      return NextResponse.json(
        { error: restaurant.holiday_message || "Restaurant is currently closed" },
        { status: 400 }
      );
    }

    // ── Timezone-aware opening hours check (BUG-008) ──
    const tz = restaurant.timezone || "Europe/London";
    const nowInTz = new Date(
      new Date().toLocaleString("en-US", { timeZone: tz })
    );
    const dayOfWeek = nowInTz.getDay();
    const currentTime =
      String(nowInTz.getHours()).padStart(2, "0") +
      ":" +
      String(nowInTz.getMinutes()).padStart(2, "0");

    const { data: todayHours } = await supabaseAdmin
      .from("opening_hours")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .eq("day_of_week", dayOfWeek)
      .single();

    if (
      !todayHours ||
      todayHours.is_closed ||
      currentTime < todayHours.open_time ||
      currentTime > todayHours.close_time
    ) {
      return NextResponse.json({ error: "Restaurant is currently closed" }, { status: 400 });
    }

    // ── Verify order type is enabled ──
    if (order_type === "delivery" && !restaurant.delivery_enabled) {
      return NextResponse.json({ error: "Delivery is not available" }, { status: 400 });
    }
    if (order_type === "collection" && !restaurant.collection_enabled) {
      return NextResponse.json({ error: "Collection is not available" }, { status: 400 });
    }

    // ── Fetch menu items AND their modifiers from DB ──
    const itemIds = [...new Set(items.map((i: any) => i.item_id))];
    const { data: menuItems } = await supabaseAdmin
      .from("menu_items")
      .select("id, price, is_available, name")
      .in("id", itemIds);

    if (!menuItems) {
      return NextResponse.json({ error: "Failed to verify items" }, { status: 500 });
    }

    // ── BUG-001 FIX: Fetch modifier prices from DB ──
    const { data: dbModifiers } = await supabaseAdmin
      .from("item_modifiers")
      .select("id, item_id, name, options")
      .in("item_id", itemIds);

    // Build lookup: { item_id → { modifierName → { optionName → price } } }
    const modifierLookup: Record<string, Record<string, Record<string, number>>> = {};
    if (dbModifiers) {
      for (const mod of dbModifiers) {
        if (!modifierLookup[mod.item_id]) modifierLookup[mod.item_id] = {};
        const optionMap: Record<string, number> = {};
        const options = (mod.options as any[]) || [];
        for (const opt of options) {
          optionMap[opt.name] = opt.price || 0;
        }
        modifierLookup[mod.item_id][mod.name] = optionMap;
      }
    }

    // ── Calculate totals with SERVER-SIDE modifier prices ──
    let subtotal = 0;
    const verifiedItems = items.map((cartItem: any) => {
      const dbItem = menuItems.find((m) => m.id === cartItem.item_id);
      if (!dbItem) throw new Error(`Item ${cartItem.item_id} not found`);
      if (!dbItem.is_available) throw new Error(`${dbItem.name} is no longer available`);

      // Verify each modifier against DB — NEVER trust client prices
      let verifiedModifierTotal = 0;
      const verifiedModifiers: { name: string; option: string; price: number }[] = [];

      if (cartItem.modifiers && Array.isArray(cartItem.modifiers)) {
        for (const clientMod of cartItem.modifiers) {
          const modName = clientMod.name || "";
          const optName = clientMod.option || "";

          // Look up the REAL price from DB
          const itemMods = modifierLookup[cartItem.item_id] || {};
          const optionMap = itemMods[modName];

          let dbPrice = 0;
          if (optionMap && optName in optionMap) {
            dbPrice = optionMap[optName];
          } else {
            log.warn("Modifier not found in DB — possible tampering", {
              item_id: cartItem.item_id,
              modifier: modName,
              option: optName,
              client_price: clientMod.price,
            });
          }

          verifiedModifierTotal += dbPrice;
          verifiedModifiers.push({
            name: modName,
            option: optName,
            price: dbPrice,
          });
        }
      }

      const itemTotal = (dbItem.price + verifiedModifierTotal) * cartItem.quantity;
      subtotal += itemTotal;

      return {
        item_id: cartItem.item_id,
        name: dbItem.name,
        price: dbItem.price + verifiedModifierTotal,
        quantity: cartItem.quantity,
        modifiers: verifiedModifiers,
        notes: cartItem.notes?.substring(0, 200) || null,
      };
    });

    // ── Delivery fee ──
    let deliveryFee = 0;
    if (order_type === "delivery") {
      deliveryFee = restaurant.delivery_fee || 0;
      if (subtotal < restaurant.min_order_delivery) {
        return NextResponse.json(
          { error: `Minimum order for delivery is £${(restaurant.min_order_delivery / 100).toFixed(2)}` },
          { status: 400 }
        );
      }
    } else {
      if (subtotal < restaurant.min_order_collection) {
        return NextResponse.json(
          { error: `Minimum order for collection is £${(restaurant.min_order_collection / 100).toFixed(2)}` },
          { status: 400 }
        );
      }
    }

    // ── Promo code ──
    let discount = 0;
    let promoCodeUsed = null;

    if (promo_code) {
      const { data: promo } = await supabaseAdmin
        .from("promo_codes")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .eq("code", promo_code.toUpperCase().trim().substring(0, 20))
        .eq("is_active", true)
        .single();

      if (promo) {
        const isExpired = promo.expiry && new Date(promo.expiry) < new Date();
        const isMaxedOut = promo.max_uses && promo.use_count >= promo.max_uses;
        const belowMin = subtotal < promo.min_order;

        if (!isExpired && !isMaxedOut && !belowMin) {
          if (promo.type === "percentage") {
            discount = Math.round(subtotal * (promo.value / 100));
          } else if (promo.type === "fixed") {
            discount = Math.min(promo.value, subtotal);
          } else if (promo.type === "free_delivery") {
            deliveryFee = 0;
          }
          promoCodeUsed = promo.code;
        }
      }
    }

    const total = subtotal + deliveryFee - discount;

    if (total <= 0) {
      return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
    }

    // ── Create PaymentIntent ──
    const paymentIntentData: any = {
      amount: total,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        restaurant_id,
        customer_email,
        order_type,
        promo_code: promoCodeUsed || "",
      },
    };

    if (restaurant.stripe_account_id) {
      paymentIntentData.application_fee_amount = calculatePlatformFee(total);
      paymentIntentData.transfer_data = {
        destination: restaurant.stripe_account_id,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    // ── Store pending order in DB ──
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id,
        customer_name: customer_name.trim(),
        customer_email: customer_email.toLowerCase().trim(),
        customer_phone: customer_phone.trim(),
        items: verifiedItems,
        subtotal,
        delivery_fee: deliveryFee,
        discount,
        vat_amount: restaurant.vat_registered
          ? Math.round(total - total / (1 + (restaurant.vat_rate || 20) / 100))
          : 0,
        total,
        status: "pending",
        order_type,
        delivery_address: delivery_address?.trim()?.substring(0, 500) || null,
        notes: notes?.trim()?.substring(0, 500) || null,
        stripe_payment_intent_id: paymentIntent.id,
        allergen_confirmed: true,
        promo_code_used: promoCodeUsed,
      })
      .select("id, order_number")
      .single();

    if (orderErr) {
      log.error("Order creation failed", { error: orderErr.message, restaurant_id });
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    log.info("Checkout success", {
      orderId: order.id,
      orderNumber: order.order_number,
      restaurant_id,
      total,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      orderNumber: order.order_number,
      total,
    });
  } catch (err: any) {
    log.error("Checkout error", { error: err.message, stack: err.stack });
    return NextResponse.json(
      { error: err.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
