"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Package,
  Truck,
  Utensils,
  MapPin,
  Loader2,
  XCircle,
  ArrowLeft,
  Wifi,
} from "lucide-react";
import { formatPrice, formatDateTime, cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const DELIVERY_STEPS = [
  { key: "confirmed", label: "Order Confirmed", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Package },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPin },
];

const COLLECTION_STEPS = [
  { key: "confirmed", label: "Order Confirmed", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready for Collection", icon: Package },
  { key: "collected", label: "Collected", icon: CheckCircle2 },
];

function StatusTracker({ status, orderType }: { status: string; orderType: string }) {
  const steps = orderType === "delivery" ? DELIVERY_STEPS : COLLECTION_STEPS;
  const currentIndex = steps.findIndex((s) => s.key === status);

  if (status === "pending") {
    return (
      <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
        <div>
          <p className="font-medium text-yellow-800">Processing payment...</p>
          <p className="text-sm text-yellow-600">This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  if (status === "cancelled" || status === "refunded") {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
        <XCircle className="h-5 w-5 text-red-500" />
        <div>
          <p className="font-medium text-red-800">
            Order {status === "cancelled" ? "Cancelled" : "Refunded"}
          </p>
          <p className="text-sm text-red-600">
            {status === "refunded"
              ? "Your refund will appear in 5-10 business days."
              : "This order has been cancelled."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const isComplete = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                isComplete ? "bg-success-500 text-white" : "bg-gray-200 text-gray-400"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              {i < steps.length - 1 && (
                <div className={cn("w-0.5 h-8 transition-colors", i < currentIndex ? "bg-success-500" : "bg-gray-200")} />
              )}
            </div>
            <div className="pt-1">
              <p className={cn("text-sm font-medium", isComplete ? "text-gray-900" : "text-gray-400")}>{step.label}</p>
              {isCurrent && (
                <p className="text-xs text-success-500 mt-0.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-success-500 rounded-full animate-pulse" />
                  Current
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLive, setIsLive] = useState(false);

  const redirectStatus = searchParams.get("redirect_status");

  // Initial fetch
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/orders/status?id=${orderId}`);
        if (!res.ok) { setError("Order not found"); setLoading(false); return; }
        setOrder(await res.json());
      } catch {
        setError("Failed to load order");
      }
      setLoading(false);
    })();
  }, [orderId]);

  // Supabase Realtime subscription (BUG-002 FIX)
  useEffect(() => {
    if (!order) return;
    const terminal = ["delivered", "collected", "cancelled", "refunded"];
    if (terminal.includes(order.status)) return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setOrder((prev: any) => (prev ? { ...prev, status: updated.status } : prev));
        }
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    // Fallback poll every 30s in case Realtime drops
    const fallback = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/status?id=${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder((prev: any) => (prev ? { ...prev, status: data.status } : prev));
        }
      } catch { /* ignore */ }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallback);
    };
  }, [order?.id, order?.status, orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Order not found</h1>
          <Link href={`/${slug}`} className="text-brand-600 text-sm hover:underline">Back to menu</Link>
        </div>
      </div>
    );
  }

  const restaurant = order.restaurants as any;
  const estimatedMins = order.order_type === "delivery"
    ? restaurant?.estimated_delivery_mins || 45
    : restaurant?.estimated_collection_mins || 20;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/${slug}`} className="p-1 hover:bg-gray-100 rounded">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold">Order #{order.order_number}</h1>
            <p className="text-xs text-gray-500">{restaurant?.name}</p>
          </div>
          {/* Live indicator */}
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Wifi className="h-3 w-3" />
              Live
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Success banner */}
        {(redirectStatus === "succeeded" || order.status !== "pending") &&
          order.status !== "cancelled" && order.status !== "refunded" && (
            <div className="bg-success-50 rounded-xl p-5 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-500 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-gray-900">Thank you for your order!</h2>
              <p className="text-sm text-gray-600 mt-1">
                {order.order_type === "delivery"
                  ? `Estimated delivery in ~${estimatedMins} minutes`
                  : `Ready for collection in ~${estimatedMins} minutes`}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                A confirmation email has been sent to {order.customer_email}
              </p>
            </div>
          )}

        {/* Restaurant contact info */}
        {restaurant && (
          <div className="card p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-brand-50 rounded-full flex items-center justify-center shrink-0">
              <Utensils className="h-5 w-5 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{restaurant.name}</p>
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`} className="text-xs text-brand-600 hover:underline">
                  {restaurant.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Status tracker */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Order Status</h3>
          <StatusTracker status={order.status} orderType={order.order_type} />
        </div>

        {/* Order details */}
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Order Details</h3>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Order type</span>
              <span className="capitalize">{order.order_type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Placed</span>
              <span>{formatDateTime(order.created_at)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Customer</span>
              <span>{order.customer_name}</span>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            {order.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {item.quantity}x {item.name}
                  {item.modifiers?.length > 0 && (
                    <span className="text-gray-400 text-xs ml-1">
                      ({item.modifiers.map((m: any) => m.option).join(", ")})
                    </span>
                  )}
                </span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Delivery</span>
                <span>{formatPrice(order.delivery_fee)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-sm text-success-500">
                <span>Discount</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href={`/${slug}`} className="text-brand-600 text-sm hover:underline inline-flex items-center gap-1">
            <Utensils className="h-3 w-3" />
            Order again from {restaurant?.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
