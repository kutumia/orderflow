"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  ArrowLeft,
  Loader2,
  ShoppingBag,
  MapPin,
  Clock,
  Tag,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import { CartProvider, useCart } from "@/components/ordering/CartContext";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ── PAYMENT FORM (inside Stripe Elements) ──
function PaymentForm({
  orderId,
  orderNumber,
  slug,
}: {
  orderId: string;
  orderNumber: number;
  slug: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { clearCart } = useCart();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPaying(true);
    setError("");

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${slug}/order/${orderId}`,
      },
    });

    if (submitError) {
      setError(submitError.message || "Payment failed");
      setPaying(false);
    } else {
      clearCart();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      {error && (
        <div className="mt-3 bg-danger-50 text-danger-500 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={paying || !stripe}
        className="btn-primary w-full mt-4 flex items-center justify-center gap-2 py-3"
      >
        {paying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing payment...
          </>
        ) : (
          <>Pay Now</>
        )}
      </button>
    </form>
  );
}

// ── MAIN CHECKOUT ──
function CheckoutContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { items, subtotal, itemCount } = useCart();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    orderType: "collection" as "delivery" | "collection" | "dine_in",
    address: "",
    notes: "",
    promoCode: "",
    allergenConfirmed: false,
    tableNumber: "",
    loyaltyReward: "",
    loyaltyDiscount: 0,
  });

  // Promo state
  const [promoResult, setPromoResult] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  // Checkout state
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderNumber, setOrderNumber] = useState(0);
  const [checkoutTotal, setCheckoutTotal] = useState(0);
  const [checkoutError, setCheckoutError] = useState("");
  const [loyaltyData, setLoyaltyData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load restaurant data
  useEffect(() => {
    fetch(`/api/restaurants?slug=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setRestaurant(data.restaurant);
        if (data.restaurant?.delivery_enabled && !data.restaurant?.collection_enabled) {
          setForm((prev) => ({ ...prev, orderType: "delivery" }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  // Redirect if cart empty
  useEffect(() => {
    if (!loading && itemCount === 0) {
      router.push(`/${slug}`);
    }
  }, [loading, itemCount, slug, router]);

  // Calculate totals
  const deliveryFee =
    form.orderType === "delivery" ? restaurant?.delivery_fee || 0 : 0;
  const discount = promoResult?.discount || 0;
  const freeDelivery = promoResult?.type === "free_delivery";
  const effectiveDeliveryFee = freeDelivery ? 0 : deliveryFee;
  const total = subtotal + effectiveDeliveryFee - discount;

  const validatePromo = async () => {
    if (!form.promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    setPromoResult(null);

    const res = await fetch("/api/promo-codes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.promoCode,
        restaurant_id: restaurant.id,
        subtotal,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setPromoResult(data);
    } else {
      setPromoError(data.error || "Invalid code");
    }
    setPromoLoading(false);
  };

  const handleCheckout = async () => {
    setCheckoutError("");

    if (!form.name.trim()) { setCheckoutError("Name is required"); return; }
    if (!form.email.trim()) { setCheckoutError("Email is required"); return; }
    if (!form.phone.trim()) { setCheckoutError("Phone number is required"); return; }
    if (form.orderType === "delivery" && !form.address.trim()) {
      setCheckoutError("Delivery address is required");
      return;
    }
    if (!form.allergenConfirmed) {
      setCheckoutError("Please confirm you have reviewed allergen information");
      return;
    }

    // Check minimums
    const minOrder = form.orderType === "delivery"
      ? restaurant.min_order_delivery
      : restaurant.min_order_collection;
    if (subtotal < minOrder) {
      setCheckoutError(`Minimum order is ${formatPrice(minOrder)} for ${form.orderType}`);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          items: items.map((i) => ({
            item_id: i.item_id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            modifiers: i.modifiers,
            notes: i.notes,
          })),
          order_type: form.orderType,
          delivery_address: form.address || null,
          table_number: form.orderType === "dine_in" ? parseInt(form.tableNumber) || null : null,
          notes: form.notes || null,
          promo_code: promoResult?.code || null,
          allergen_confirmed: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCheckoutError(data.error || "Checkout failed");
        setSubmitting(false);
        return;
      }

      setClientSecret(data.clientSecret);
      setOrderId(data.orderId);
      setOrderNumber(data.orderNumber);
      setCheckoutTotal(data.total);

      // Save to localStorage for "Order Again"
      try {
        const recent = { items: items.map((i: any) => ({ name: i.name, quantity: i.quantity, modifiers: i.modifiers })), date: new Date().toISOString() };
        const key = `orderflow_recent_${slug}`;
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(key, JSON.stringify([recent, ...existing].slice(0, 5)));
      } catch { /* */ }
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 hover:bg-gray-100 rounded">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold">Checkout</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* If we have a clientSecret, show payment form */}
        {clientSecret ? (
          <div>
            <div className="card p-5 mb-4">
              <div className="flex items-center gap-2 text-success-500 mb-3">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Order #{orderNumber} created</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Complete your payment below to confirm the order.
              </p>
              <div className="text-2xl font-bold text-center mb-4">
                {formatPrice(checkoutTotal)}
              </div>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: { colorPrimary: "#2E86C1" },
                  },
                }}
              >
                <PaymentForm orderId={orderId} orderNumber={orderNumber} slug={slug} />
              </Elements>
            </div>
          </div>
        ) : (
          <>
            {/* Order Type */}
            <div className="card p-5">
              <h2 className="font-semibold mb-3">Order Type</h2>
              <div className="grid grid-cols-2 gap-3">
                {restaurant.collection_enabled && (
                  <button
                    onClick={() => setForm({ ...form, orderType: "collection" })}
                    className={cn(
                      "p-4 rounded-lg border text-center transition-colors",
                      form.orderType === "collection"
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="font-medium text-sm">Collection</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" />
                      ~{restaurant.estimated_collection_mins} mins
                    </div>
                  </button>
                )}
                {restaurant.delivery_enabled && (
                  <button
                    onClick={() => setForm({ ...form, orderType: "delivery" })}
                    className={cn(
                      "p-4 rounded-lg border text-center transition-colors",
                      form.orderType === "delivery"
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="font-medium text-sm">Delivery</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" />
                      ~{restaurant.estimated_delivery_mins} mins
                      {deliveryFee > 0 && !freeDelivery && ` · ${formatPrice(deliveryFee)}`}
                    </div>
                  </button>
                )}
                <button
                  onClick={() => setForm({ ...form, orderType: "dine_in" })}
                  className={cn(
                    "p-4 rounded-lg border text-center transition-colors",
                    form.orderType === "dine_in"
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="font-medium text-sm">Dine In</div>
                  <div className="text-xs text-gray-500 mt-1">Order to your table</div>
                </button>
              </div>
            </div>

            {/* Customer Details */}
            <div className="card p-5">
              <h2 className="font-semibold mb-3">Your Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">Name *</label>
                  <input
                    className="input-field"
                    placeholder="Your full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="you@email.com"
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      // Check loyalty when email is valid
                      const email = e.target.value.trim();
                      if (email.includes("@") && email.includes(".") && restaurant) {
                        fetch(`/api/loyalty/check?restaurant_id=${restaurant.id}&email=${encodeURIComponent(email)}`)
                          .then(r => r.json())
                          .then(data => {
                            if (data.active && data.card) setLoyaltyData(data);
                            else setLoyaltyData(null);
                          })
                          .catch(() => setLoyaltyData(null));
                      }
                    }}
                  />
                </div>
                {/* Loyalty card progress */}
                {loyaltyData?.card && loyaltyData?.program && (
                  <div className="bg-brand-50 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-brand-700 font-medium">
                        {loyaltyData.program.type === "stamps"
                          ? `${(loyaltyData.card.stamps_earned || 0) - (loyaltyData.card.stamps_redeemed || 0)} of ${loyaltyData.program.stamps_required} stamps`
                          : `${loyaltyData.card.points_balance || 0} points`
                        }
                      </span>
                    </div>
                    {loyaltyData.program.type === "stamps" && (
                      <div className="flex gap-1">
                        {Array.from({ length: loyaltyData.program.stamps_required }).map((_, i) => (
                          <div key={i} className={cn("h-6 w-6 rounded-full border",
                            i < (loyaltyData.card.stamps_earned - loyaltyData.card.stamps_redeemed)
                              ? "bg-brand-600 border-brand-600" : "bg-white border-gray-300"
                          )} />
                        ))}
                      </div>
                    )}
                    {loyaltyData.canRedeem && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch("/api/loyalty/check", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ restaurant_id: restaurant?.id, email: form.email }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            if (data.reward_type === "free_delivery") {
                              setForm({ ...form, loyaltyReward: "free_delivery" });
                            } else if (data.reward_type === "discount") {
                              setForm({ ...form, loyaltyReward: "discount", loyaltyDiscount: data.reward_value });
                            }
                            setLoyaltyData(null);
                          }
                        }}
                        className="mt-2 text-xs font-medium text-brand-700 hover:text-brand-800 underline"
                      >
                        🎁 Redeem your reward!
                      </button>
                    )}
                  </div>
                )}
                <div>
                  <label className="label">Phone *</label>
                  <input
                    className="input-field"
                    type="tel"
                    placeholder="07123 456789"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                {form.orderType === "delivery" && (
                  <div>
                    <label className="label">Delivery Address *</label>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Full delivery address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                )}
                {form.orderType === "dine_in" && (
                  <div>
                    <label className="label">Table Number *</label>
                    <input
                      className="input-field w-32"
                      type="number"
                      min={1}
                      placeholder="e.g. 5"
                      value={form.tableNumber}
                      onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Order Notes (optional)</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Any special requests..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Promo Code */}
            <div className="card p-5">
              <h2 className="font-semibold mb-3">Promo Code</h2>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    className="input-field pl-10"
                    placeholder="Enter code"
                    value={form.promoCode}
                    onChange={(e) => {
                      setForm({ ...form, promoCode: e.target.value.toUpperCase() });
                      setPromoResult(null);
                      setPromoError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && validatePromo()}
                  />
                </div>
                <button
                  onClick={validatePromo}
                  disabled={promoLoading || !form.promoCode.trim()}
                  className="btn-secondary shrink-0"
                >
                  {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </button>
              </div>
              {promoResult && (
                <div className="mt-2 flex items-center gap-2 text-sm text-success-500">
                  <CheckCircle2 className="h-4 w-4" />
                  {promoResult.description} applied!
                </div>
              )}
              {promoError && (
                <div className="mt-2 text-sm text-danger-500">{promoError}</div>
              )}
            </div>

            {/* Order Summary */}
            <div className="card p-5">
              <h2 className="font-semibold mb-3">Order Summary</h2>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.quantity}x {item.name}
                      {item.modifiers.length > 0 && (
                        <span className="text-gray-400 text-xs ml-1">
                          ({item.modifiers.map((m) => m.option).join(", ")})
                        </span>
                      )}
                    </span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {effectiveDeliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Delivery</span>
                      <span>{formatPrice(effectiveDeliveryFee)}</span>
                    </div>
                  )}
                  {freeDelivery && deliveryFee > 0 && (
                    <div className="flex justify-between text-sm text-success-500">
                      <span>Free delivery</span>
                      <span>-{formatPrice(deliveryFee)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-success-500">
                      <span>Discount</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  {restaurant?.vat_registered && total > 0 && (
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Includes VAT ({restaurant.vat_rate || 20}%)</span>
                      <span>{formatPrice(Math.round(total - total / (1 + (restaurant.vat_rate || 20) / 100)))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Allergen Confirmation */}
            <div className="card p-5">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="allergen"
                  checked={form.allergenConfirmed}
                  onChange={(e) => setForm({ ...form, allergenConfirmed: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                <label htmlFor="allergen" className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">Allergen Confirmation *</span>
                  <br />
                  I have reviewed the allergen information for all items in my order and
                  confirm that my order is suitable for my dietary requirements.
                </label>
              </div>
            </div>

            {/* Error */}
            {checkoutError && (
              <div className="bg-danger-50 text-danger-500 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {checkoutError}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleCheckout}
              disabled={submitting}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating order...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Proceed to Payment · {formatPrice(total)}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <CartProvider slug={slug}>
      <CheckoutContent />
    </CartProvider>
  );
}
