"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Monitor,
  ExternalLink,
  ChefHat,
  Package,
  Clock,
  Loader2,
  RefreshCw,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export default function KitchenPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const slug = user?.restaurant_slug;
  const restaurantId = user?.restaurant_id;

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!slug) return;
    const res = await fetch(`/api/kitchen?slug=${slug}`);
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }, [slug]);

  // Initial fetch + Realtime subscription (BUG-002 FIX)
  useEffect(() => {
    if (!restaurantId) return;

    fetchOrders();

    const channel = supabase
      .channel(`dashboard-kitchen-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as any;
          if (newOrder.restaurant_id !== restaurantId) return;
          const liveStatuses = ["confirmed", "preparing", "ready", "out_for_delivery"];
          if (liveStatuses.includes(newOrder.status)) {
            setOrders((prev) => {
              if (prev.find((o) => o.id === newOrder.id)) return prev;
              return [newOrder, ...prev];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as any;
          if (updated.restaurant_id !== restaurantId) return;
          const terminal = ["delivered", "collected", "cancelled", "refunded"];
          setOrders((prev) => {
            if (terminal.includes(updated.status)) {
              return prev.filter((o) => o.id !== updated.id);
            }
            return prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o));
          });
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    // Fallback poll every 30s
    const fallback = setInterval(fetchOrders, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallback);
    };
  }, [restaurantId, slug, fetchOrders]);

  const kdsUrl = typeof window !== "undefined"
    ? `${window.location.origin}/kitchen/${slug}`
    : "";

  const newCount = orders.filter((o) => o.status === "confirmed").length;
  const cookingCount = orders.filter((o) => o.status === "preparing").length;
  const readyCount = orders.filter((o) => o.status === "ready" || o.status === "out_for_delivery").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Kitchen Display</h1>
          <p className="text-gray-500 text-sm mt-1">
            Full-screen order management for your kitchen staff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Realtime connection status */}
          <span className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
            connected ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
          )}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Live" : "Connecting..."}
          </span>
          <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <a
            href={kdsUrl}
            target="_blank"
            rel="noopener"
            className="btn-primary flex items-center gap-2"
          >
            <Monitor className="h-4 w-4" />
            Open Full-Screen KDS
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* KDS Link Card */}
      <div className="card p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
            <Monitor className="h-6 w-6 text-brand-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Kitchen Display System (KDS)</h3>
            <p className="text-sm text-gray-500 mb-3">
              Open this link on a dedicated screen or tablet in your kitchen.
              Staff can see and manage orders without logging in.
            </p>
            <div className="flex items-center gap-3">
              <code className="bg-gray-100 px-4 py-2 rounded-lg text-sm text-brand-700 flex-1 truncate">
                {kdsUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(kdsUrl)}
                className="btn-secondary text-sm shrink-0"
              >
                Copy
              </button>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                Real-time updates via Supabase
              </span>
              <span className="flex items-center gap-1">
                <Volume2 className="h-3 w-3" />
                Audio alerts for new orders
              </span>
              <span>Supports fullscreen mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{newCount}</div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> New Orders
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">{cookingCount}</div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <ChefHat className="h-3 w-3" /> Cooking
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{readyCount}</div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Package className="h-3 w-3" /> Ready
          </div>
        </div>
      </div>

      {/* Order list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center">
          <ChefHat className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No active orders right now.</p>
        </div>
      ) : (
        <div className="card divide-y">
          {orders.map((order) => {
            const mins = Math.floor(
              (Date.now() - new Date(order.created_at).getTime()) / 60000
            );
            return (
              <div key={order.id} className="flex items-center gap-4 px-4 py-3">
                <span className="font-bold text-sm w-16">#{order.order_number}</span>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full",
                  order.status === "confirmed" && "bg-blue-50 text-blue-700",
                  order.status === "preparing" && "bg-orange-50 text-orange-700",
                  (order.status === "ready" || order.status === "out_for_delivery") && "bg-green-50 text-green-700"
                )}>
                  {order.status === "confirmed" ? "New" :
                   order.status === "preparing" ? "Cooking" : "Ready"}
                </span>
                <span className="text-sm text-gray-600 flex-1">{order.customer_name}</span>
                <span className="text-xs text-gray-400 capitalize">{order.order_type}</span>
                <span className="text-xs text-gray-400">{order.items?.length} items</span>
                <span className={cn("text-xs font-medium", mins > 20 ? "text-red-500" : "text-gray-400")}>
                  {mins}m ago
                </span>
                <span className="text-sm font-medium">{formatPrice(order.total)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
