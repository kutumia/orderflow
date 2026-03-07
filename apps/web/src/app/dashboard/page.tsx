"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ShoppingBag, PoundSterling, Users, TrendingUp,
  ArrowRight, UtensilsCrossed, Printer, Settings,
  CheckCircle2, CreditCard, Loader2,
} from "lucide-react";
import { formatPrice, formatDateTime, cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-blue-600 bg-blue-50",
  preparing: "text-orange-600 bg-orange-50",
  ready: "text-green-600 bg-green-50",
  delivered: "text-gray-500 bg-gray-100",
  collected: "text-gray-500 bg-gray-100",
  cancelled: "text-red-600 bg-red-50",
  refunded: "text-red-600 bg-red-50",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/dashboard-stats")
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
    // Fetch locations for multi-location banner
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.locations || []))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Multi-location banner */}
      {locations.length > 1 && (
        <div className="mb-6 bg-brand-50 border border-brand-100 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-brand-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-800">You have {locations.length} locations</p>
              <p className="text-xs text-brand-600">
                Currently viewing: {locations.find((l: any) => l.is_current)?.name || "—"}
              </p>
            </div>
          </div>
          <Link href="/dashboard/franchise" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            Franchise Overview <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your restaurant today.</p>
      </div>

      {/* Setup Checklist */}
      {/* Fix #24: Dynamic Setup Checklist with live progress */}
      <OnboardingChecklist />

      {/* Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Today's Revenue", value: stats ? formatPrice(stats.today_revenue) : "—", icon: PoundSterling },
          { label: "Today's Orders", value: stats?.today_orders?.toString() || "—", icon: ShoppingBag },
          { label: "Total Customers", value: stats?.total_customers?.toString() || "—", icon: Users },
          { label: "Avg. Order (30d)", value: stats ? formatPrice(stats.avg_order_value) : "—", icon: TrendingUp },
        ].map((m) => (
          <div key={m.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{m.label}</span>
              <div className="h-8 w-8 bg-brand-50 rounded-lg flex items-center justify-center">
                <m.icon className="h-4 w-4 text-brand-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-gray-300" /> : m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-brand-600 mx-auto" /></div>
        ) : stats?.recent_orders?.length > 0 ? (
          <div className="divide-y">
            {stats.recent_orders.map((order: any) => (
              <div key={order.id} className="flex items-center gap-4 px-5 py-3">
                <span className="font-bold text-sm w-16">#{order.order_number}</span>
                <span className={cn("text-xs font-medium px-2 py-1 rounded-full capitalize", STATUS_COLORS[order.status] || "bg-gray-100 text-gray-500")}>
                  {order.status}
                </span>
                <span className="text-sm text-gray-600 flex-1">{order.customer_name}</span>
                <span className="text-xs text-gray-400 capitalize">{order.order_type}</span>
                <span className="text-sm font-medium">{formatPrice(order.total)}</span>
                <span className="text-xs text-gray-400 w-28 text-right">{formatDateTime(order.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No orders yet.</p>
            <p className="text-gray-400 text-xs mt-1">Orders will appear here as customers place them.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardingChecklist() {
  const [progress, setProgress] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding-progress")
      .then((r) => r.json())
      .then((data) => setProgress(data))
      .catch(() => {});
  }, []);

  if (!progress || dismissed) return null;

  const steps = [
    { key: "profile_complete", label: "Restaurant profile", desc: "Name, address, cuisine", href: "/dashboard/settings", icon: Settings },
    { key: "menu_items", label: "Menu items (3+)", desc: "Add categories & dishes", href: "/dashboard/menu", icon: UtensilsCrossed },
    { key: "hours_set", label: "Opening hours", desc: "Set your schedule", href: "/dashboard/hours", icon: CheckCircle2 },
    { key: "stripe_connected", label: "Payments connected", desc: "Connect Stripe", href: "/dashboard/billing", icon: CreditCard },
    { key: "printer_connected", label: "Printer set up", desc: "Optional but recommended", href: "/dashboard/printer", icon: Printer },
  ];

  const completed = steps.filter((s) => progress[s.key]).length;
  const allDone = completed === steps.length;

  if (allDone) return null; // Don't show if fully onboarded

  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold">Ready to Go Live</h2>
          <p className="text-xs text-gray-400 mt-0.5">{completed}/{steps.length} steps complete</p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
      </div>
      <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-2">
        {steps.map((step) => {
          const done = progress[step.key];
          return (
            <Link key={step.key} href={step.href}
              className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors",
                done ? "bg-success-50/50 border-success-100" : "border-gray-200 hover:border-brand-300 hover:bg-brand-50/30"
              )}>
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                done ? "bg-success-500" : "bg-gray-200"
              )}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : <step.icon className="h-3 w-3 text-gray-500" />}
              </div>
              <div className="flex-1">
                <span className={cn("text-sm font-medium", done ? "text-gray-500 line-through" : "text-gray-900")}>{step.label}</span>
                {!done && <span className="text-xs text-gray-400 ml-2">{step.desc}</span>}
              </div>
              {!done && <ArrowRight className="h-3.5 w-3.5 text-gray-400" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
