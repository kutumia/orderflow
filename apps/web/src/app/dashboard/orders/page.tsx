"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  ShoppingBag, Loader2, Clock, CheckCircle2, ChefHat, Package,
  Truck, XCircle, RefreshCw, Phone, MapPin, ChevronDown,
  RotateCcw, Printer, AlertTriangle,
} from "lucide-react";
import { formatPrice, formatDateTime, cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Pending", color: "text-yellow-700", bg: "bg-yellow-50", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-blue-700", bg: "bg-blue-50", icon: CheckCircle2 },
  preparing: { label: "Preparing", color: "text-orange-700", bg: "bg-orange-50", icon: ChefHat },
  ready: { label: "Ready", color: "text-green-700", bg: "bg-green-50", icon: Package },
  out_for_delivery: { label: "Out for Delivery", color: "text-purple-700", bg: "bg-purple-50", icon: Truck },
  delivered: { label: "Delivered", color: "text-gray-500", bg: "bg-gray-100", icon: CheckCircle2 },
  collected: { label: "Collected", color: "text-gray-500", bg: "bg-gray-100", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50", icon: XCircle },
  refunded: { label: "Refunded", color: "text-red-700", bg: "bg-red-50", icon: RotateCcw },
};

const NEXT_STATUS: Record<string, string> = {
  confirmed: "preparing", preparing: "ready", ready: "out_for_delivery",
};
const NEXT_STATUS_COLLECTION: Record<string, string> = {
  confirmed: "preparing", preparing: "ready", ready: "collected",
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", config.bg, config.color)}>
      <Icon className="h-3 w-3" /> {config.label}
    </span>
  );
}

function OrderCard({ order, onRefresh, isOwner }: { order: any; onRefresh: () => void; isOwner: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundError, setRefundError] = useState("");

  const nextMap = order.order_type === "collection" ? NEXT_STATUS_COLLECTION : NEXT_STATUS;
  const nextStatus = nextMap[order.status];
  const isActive = !["delivered", "collected", "cancelled", "refunded"].includes(order.status);
  const canRefund = isOwner && ["delivered", "collected", "confirmed", "preparing", "ready"].includes(order.status) && order.stripe_payment_intent_id;

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    await fetch("/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, status: newStatus }),
    });
    setUpdating(false);
    onRefresh();
  };

  const processRefund = async () => {
    setRefunding(true);
    setRefundError("");
    const res = await fetch("/api/orders/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, reason: refundReason }),
    });
    if (res.ok) {
      setShowRefundForm(false);
      onRefresh();
    } else {
      const data = await res.json();
      setRefundError(data.error || "Refund failed");
    }
    setRefunding(false);
  };

  const reprintOrder = async () => {
    await fetch("/api/print-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id }),
    });
    onRefresh();
  };

  return (
    <div className={cn("card overflow-hidden", isActive && "border-l-4 border-l-brand-500")}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-base">#{order.order_number}</span>
            <StatusBadge status={order.status} />
            <span className="text-xs text-gray-400 capitalize">{order.order_type}</span>
          </div>
          <div className="text-sm text-gray-600">{order.customer_name}</div>
          <div className="text-xs text-gray-400">{formatDateTime(order.created_at)}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{formatPrice(order.total)}</div>
          <div className="text-xs text-gray-400">{order.items?.length || 0} items</div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-gray-500"><Phone className="h-3.5 w-3.5" />{order.customer_phone}</span>
            {order.delivery_address && (
              <span className="flex items-center gap-1.5 text-gray-500"><MapPin className="h-3.5 w-3.5" />{order.delivery_address}</span>
            )}
          </div>

          <div className="space-y-1.5">
            {order.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.quantity}x {item.name}
                  {item.modifiers?.length > 0 && <span className="text-gray-400 text-xs ml-1">({item.modifiers.map((m: any) => m.option).join(", ")})</span>}
                </span>
                <span className="text-gray-600">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="bg-yellow-50 text-yellow-800 text-sm px-3 py-2 rounded-lg">
              <strong>Note:</strong> {order.notes}
            </div>
          )}

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
            {order.delivery_fee > 0 && <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span>{formatPrice(order.delivery_fee)}</span></div>}
            {order.discount > 0 && <div className="flex justify-between text-success-500"><span>Discount</span><span>-{formatPrice(order.discount)}</span></div>}
            {(order.vat_amount || 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">VAT</span><span>{formatPrice(order.vat_amount)}</span></div>}
            <div className="flex justify-between font-bold pt-1 border-t"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          </div>

          {/* Refund form */}
          {showRefundForm && (
            <div className="bg-red-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                <AlertTriangle className="h-4 w-4" />
                Refund {formatPrice(order.total)} to customer?
              </div>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refund (optional)"
                className="input-field text-sm w-full"
              />
              {refundError && <p className="text-xs text-red-600">{refundError}</p>}
              <div className="flex gap-2">
                <button onClick={processRefund} disabled={refunding}
                  className="btn-danger text-sm flex items-center gap-2">
                  {refunding ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Confirm Refund
                </button>
                <button onClick={() => setShowRefundForm(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            {isActive && order.status !== "pending" && nextStatus && (
              <button onClick={() => updateStatus(nextStatus)} disabled={updating}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                {updating && <Loader2 className="h-3 w-3 animate-spin" />}
                Mark as {STATUS_CONFIG[nextStatus]?.label}
              </button>
            )}
            {isActive && order.status !== "pending" && (
              <button onClick={() => updateStatus("cancelled")} disabled={updating}
                className="btn-danger text-sm px-4">Cancel</button>
            )}
            {canRefund && !showRefundForm && (
              <button onClick={() => setShowRefundForm(true)} className="btn-secondary text-sm flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Refund
              </button>
            )}
            <button onClick={reprintOrder} className="btn-secondary text-sm flex items-center gap-1">
              <Printer className="h-3 w-3" /> Reprint
            </button>
          </div>

          {/* Refund info */}
          {order.status === "refunded" && order.refunded_at && (
            <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg">
              Refunded on {formatDateTime(order.refunded_at)}
              {order.refund_reason && <> — {order.refund_reason}</>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Tab = "live" | "today" | "all";

export default function OrdersPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isOwner = user?.role === "owner";

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("live");

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`/api/orders?filter=${tab}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.orders || []);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { setLoading(true); fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (tab !== "live") return;
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [tab, fetchOrders]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Manage incoming and past orders.</p>
        </div>
        <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { key: "live" as Tab, label: "Live" },
          { key: "today" as Tab, label: "Today" },
          { key: "all" as Tab, label: "All Orders" },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-4 py-1.5 text-sm rounded-md font-medium transition-colors",
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {tab === "live" ? "No active orders right now." : tab === "today" ? "No orders today yet." : "No orders found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => <OrderCard key={o.id} order={o} onRefresh={fetchOrders} isOwner={isOwner} />)}
        </div>
      )}
    </div>
  );
}
