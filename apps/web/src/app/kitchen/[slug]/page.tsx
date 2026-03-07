"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Package,
  Truck,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize,
  RefreshCw,
  Lock,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "NEW", color: "text-white", bg: "bg-blue-600" },
  preparing: { label: "COOKING", color: "text-white", bg: "bg-orange-500" },
  ready: { label: "READY", color: "text-white", bg: "bg-green-600" },
  out_for_delivery: { label: "OUT", color: "text-white", bg: "bg-purple-600" },
};

// ── Order Ticket Component ──
function OrderTicket({
  order,
  onStatusChange,
}: {
  order: any;
  onStatusChange: (orderId: string, status: string) => void;
}) {
  const minutesAgo = Math.floor(
    (Date.now() - new Date(order.created_at).getTime()) / 60000
  );
  const isUrgent = minutesAgo > 20;
  const isVeryUrgent = minutesAgo > 30;
  const statusConf = STATUS_LABELS[order.status] || STATUS_LABELS.confirmed;

  const nextStatus: Record<string, string> = {
    confirmed: "preparing",
    preparing: "ready",
    ready: order.order_type === "collection" ? "collected" : "out_for_delivery",
  };
  const nextLabel: Record<string, string> = {
    confirmed: "START",
    preparing: "READY",
    ready: order.order_type === "collection" ? "COLLECTED" : "OUT FOR DELIVERY",
  };

  return (
    <div className={cn(
      "bg-white rounded-lg shadow-md overflow-hidden flex flex-col",
      isVeryUrgent && "ring-2 ring-red-500",
      isUrgent && !isVeryUrgent && "ring-2 ring-yellow-400"
    )}>
      <div className={cn("px-4 py-2 flex items-center justify-between", statusConf.bg)}>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg">#{order.order_number}</span>
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded", statusConf.color, "bg-white/20")}>
            {statusConf.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/80 text-xs">
          <span className="uppercase font-medium">
            {order.order_type === "delivery" ? "🚗 DEL" : "🏪 COL"}
          </span>
          <span className={cn("font-bold", isUrgent ? "text-yellow-200" : "")}>
            {minutesAgo}m
          </span>
        </div>
      </div>

      <div className="px-4 py-3 flex-1 space-y-1.5">
        {order.items?.map((item: any, i: number) => (
          <div key={i}>
            <div className="flex justify-between items-start">
              <span className="font-bold text-sm">
                <span className="text-lg mr-1">{item.quantity}x</span>
                {item.name}
              </span>
            </div>
            {item.modifiers?.map((mod: any, j: number) => (
              <div key={j} className="text-xs text-gray-500 ml-6">+ {mod.option}</div>
            ))}
            {item.notes && (
              <div className="text-xs text-orange-600 font-medium ml-6 bg-orange-50 px-2 py-0.5 rounded mt-0.5 inline-block">
                ⚠ {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {(order.notes || order.delivery_address) && (
        <div className="px-4 py-2 bg-gray-50 border-t text-xs space-y-1">
          {order.notes && <div className="text-orange-700 font-medium">📝 {order.notes}</div>}
          {order.order_type === "delivery" && order.delivery_address && (
            <div className="text-gray-500 truncate">📍 {order.delivery_address}</div>
          )}
        </div>
      )}

      {nextStatus[order.status] && (
        <button
          onClick={() => onStatusChange(order.id, nextStatus[order.status])}
          className={cn(
            "w-full py-3 text-center font-bold text-sm uppercase tracking-wide transition-colors",
            order.status === "confirmed" ? "bg-orange-500 hover:bg-orange-600 text-white"
              : order.status === "preparing" ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          )}
        >
          {nextLabel[order.status]}
        </button>
      )}
    </div>
  );
}

// ── PIN Entry Component (BUG-010) ──
function PinEntry({ slug, onSuccess }: { slug: string; onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    const saved = sessionStorage.getItem(`kds_pin_${slug}`);
    if (saved === "authenticated") onSuccess();
  }, [slug, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kitchen/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, pin }),
      });
      if (res.ok) {
        sessionStorage.setItem(`kds_pin_${slug}`, "authenticated");
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || "Invalid PIN");
      }
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <Lock className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white">Kitchen Display</h1>
          <p className="text-sm text-gray-400 mt-1">Enter your kitchen PIN to access</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter PIN"
            className="w-full text-center text-2xl tracking-[0.5em] bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg"
          >
            {loading ? "Checking..." : "Enter Kitchen"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main KDS Page ──
export default function KitchenDisplayPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [authenticated, setAuthenticated] = useState(false);
  const [needsPin, setNeedsPin] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const prevOrderCountRef = useRef(0);

  // Check if PIN is required
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/kitchen/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, pin: "__check__" }),
        });
        if (res.ok) {
          // No PIN set — allow access
          setNeedsPin(false);
          setAuthenticated(true);
        } else if (res.status === 401) {
          // PIN required — check session
          const saved = sessionStorage.getItem(`kds_pin_${slug}`);
          if (saved === "authenticated") {
            setNeedsPin(false);
            setAuthenticated(true);
          } else {
            setNeedsPin(true);
          }
        } else {
          setNeedsPin(false);
          setAuthenticated(true);
        }
      } catch {
        setNeedsPin(false);
        setAuthenticated(true);
      }
    })();
  }, [slug]);

  // Play notification sound
  const playNotification = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 350);
    } catch { /* Audio not available */ }
  }, []);

  // Fetch initial orders
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/kitchen?slug=${slug}`);
      if (!res.ok) { setError("Failed to load orders"); return; }
      const data = await res.json();
      setOrders(data);
      prevOrderCountRef.current = data.length;
      setError("");
    } catch {
      setError("Connection lost");
    }
    setLoading(false);
  }, [slug]);

  // Setup Supabase Realtime subscription (BUG-002 FIX)
  useEffect(() => {
    if (!authenticated) return;

    // Initial fetch
    fetchOrders();

    // Subscribe to realtime changes on orders table
    const channel = supabase
      .channel(`kds-${slug}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const newOrder = payload.new as any;
          // Only add if it's a live status (confirmed/preparing/ready)
          const liveStatuses = ["confirmed", "preparing", "ready", "out_for_delivery"];
          if (liveStatuses.includes(newOrder.status)) {
            setOrders((prev) => {
              // Avoid duplicates
              if (prev.find((o) => o.id === newOrder.id)) return prev;
              return [newOrder, ...prev];
            });
            if (soundEnabled) playNotification();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const updated = payload.new as any;
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

    // Fallback: refresh every 30s in case realtime misses something
    const fallback = setInterval(fetchOrders, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallback);
    };
  }, [authenticated, slug, soundEnabled, fetchOrders, playNotification]);

  // Update order status
  const updateStatus = async (orderId: string, newStatus: string) => {
    await fetch(`/api/kitchen`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, status: newStatus, slug }),
    });
    // Optimistic: update local state immediately
    const terminal = ["delivered", "collected", "cancelled", "refunded"];
    setOrders((prev) =>
      terminal.includes(newStatus)
        ? prev.filter((o) => o.id !== orderId)
        : prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  };

  const goFullscreen = () => {
    document.documentElement.requestFullscreen().catch(() => {});
  };

  // PIN gate
  if (needsPin === null) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
    </div>;
  }
  if (needsPin && !authenticated) {
    return <PinEntry slug={slug} onSuccess={() => { setNeedsPin(false); setAuthenticated(true); }} />;
  }

  // Group orders
  const newOrders = orders.filter((o) => o.status === "confirmed");
  const cooking = orders.filter((o) => o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready" || o.status === "out_for_delivery");

  const currentTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-lg">Kitchen Display</h1>
          <span className="text-gray-400 text-sm">{currentTime}</span>
          {/* Realtime connection indicator */}
          <span className={cn(
            "flex items-center gap-1 text-xs",
            connected ? "text-green-400" : "text-yellow-400"
          )}>
            <span className={cn("h-2 w-2 rounded-full", connected ? "bg-green-400" : "bg-yellow-400 animate-pulse")} />
            {connected ? "Live" : "Connecting..."}
          </span>
          {error && (
            <span className="text-red-400 text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 mr-2">{orders.length} active</span>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 hover:bg-gray-700 rounded" title={soundEnabled ? "Mute" : "Unmute"}>
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-gray-500" />}
          </button>
          <button onClick={fetchOrders} className="p-2 hover:bg-gray-700 rounded" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={goFullscreen} className="p-2 hover:bg-gray-700 rounded" title="Fullscreen">
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 p-4 h-[calc(100vh-48px)] overflow-hidden">
        {/* NEW column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse" />
            <h2 className="font-bold text-sm uppercase tracking-wider text-blue-400">New ({newOrders.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {newOrders.map((order) => <OrderTicket key={order.id} order={order} onStatusChange={updateStatus} />)}
            {newOrders.length === 0 && <div className="text-center text-gray-600 text-sm py-12">No new orders</div>}
          </div>
        </div>

        {/* COOKING column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <ChefHat className="h-4 w-4 text-orange-400" />
            <h2 className="font-bold text-sm uppercase tracking-wider text-orange-400">Cooking ({cooking.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {cooking.map((order) => <OrderTicket key={order.id} order={order} onStatusChange={updateStatus} />)}
            {cooking.length === 0 && <div className="text-center text-gray-600 text-sm py-12">Nothing cooking</div>}
          </div>
        </div>

        {/* READY column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-green-400" />
            <h2 className="font-bold text-sm uppercase tracking-wider text-green-400">Ready ({ready.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {ready.map((order) => <OrderTicket key={order.id} order={order} onStatusChange={updateStatus} />)}
            {ready.length === 0 && <div className="text-center text-gray-600 text-sm py-12">No orders ready</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
