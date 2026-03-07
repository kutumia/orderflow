"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Store, Users, ShoppingBag, PoundSterling,
  Search, Loader2, ToggleLeft, ToggleRight, ExternalLink,
  ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <Icon className="h-4 w-4 text-gray-300" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any>({ restaurants: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin?type=stats");
    if (res.ok) setStats(await res.json());
  }, []);

  const fetchRestaurants = useCallback(async () => {
    const params = new URLSearchParams({ type: "restaurants", search, page: page.toString() });
    const res = await fetch(`/api/admin?${params}`);
    if (res.ok) setRestaurants(await res.json());
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleActive = async (id: string, currentlyActive: boolean) => {
    await fetch("/api/admin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: id, is_active: !currentlyActive }),
    });
    fetchRestaurants();
  };

  const impersonate = async (restaurantId: string) => {
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurantId }),
    });
    if (res.ok) {
      const data = await res.json();
      // Store impersonation data in sessionStorage
      sessionStorage.setItem("impersonating", JSON.stringify(data.impersonating));
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 bg-brand-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">OrderFlow Admin</h1>
            <p className="text-gray-500 text-sm">Platform management</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Restaurants" value={stats?.restaurants?.toString() || "—"} icon={Store} />
          <StatCard label="Users" value={stats?.users?.toString() || "—"} icon={Users} />
          <StatCard label="Total Orders" value={stats?.orders?.toString() || "—"} icon={ShoppingBag} />
          <StatCard label="Total GMV" value={stats ? formatPrice(stats.total_gmv) : "—"} icon={PoundSterling} />
          <StatCard label="Platform Fees" value={stats ? formatPrice(stats.platform_fees) : "—"} icon={PoundSterling} />
        </div>

        {/* Restaurants */}
        <div className="card">
          <div className="p-4 border-b flex items-center gap-3">
            <h2 className="font-semibold flex-1">Restaurants</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input className="input-field pl-10 py-2 text-sm" placeholder="Search..."
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-brand-600 mx-auto" /></div>
          ) : restaurants.restaurants.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">No restaurants found.</div>
          ) : (
            <div className="divide-y">
              {restaurants.restaurants.map((r: any) => (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.name}</span>
                      <span className="text-xs text-gray-400">/{r.slug}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span className={cn("font-medium",
                        r.subscription_status === "active" ? "text-success-500" :
                        r.subscription_status === "trialing" ? "text-blue-500" : "text-gray-400"
                      )}>{r.subscription_status}</span>
                      <span>{r.order_count} orders</span>
                      <span>Created: {new Date(r.created_at).toLocaleDateString("en-GB")}</span>
                      {r.holiday_mode && <span className="text-yellow-500">Holiday mode</span>}
                    </div>
                  </div>
                  {/* Impersonate button */}
                  <button onClick={() => impersonate(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    title="View as this restaurant">
                    <Eye className="h-3.5 w-3.5" /> View As
                  </button>
                  <a href={`/${r.slug}`} target="_blank" rel="noopener"
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button onClick={() => toggleActive(r.id, r.is_active)}
                    className="p-1.5 hover:bg-gray-100 rounded"
                    title={r.is_active ? "Deactivate" : "Activate"}>
                    {r.is_active
                      ? <ToggleRight className="h-5 w-5 text-success-500" />
                      : <ToggleLeft className="h-5 w-5 text-gray-300" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {restaurants.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t">
              <span className="text-xs text-gray-400">Page {page} of {restaurants.pages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                  className="btn-secondary p-1.5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setPage(Math.min(restaurants.pages, page + 1))}
                  disabled={page >= restaurants.pages} className="btn-secondary p-1.5 disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
