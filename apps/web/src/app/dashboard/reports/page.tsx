"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, PoundSterling, ShoppingBag, Users, TrendingUp,
  Truck, Store, Tag, Loader2, Calendar, ArrowDown, Download,
  FileText,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

const COLORS = ["#1B4F72", "#2E86C1", "#85C1E9", "#AED6F1", "#D4E6F1"];

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: string; icon: any; sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <Icon className="h-4 w-4 text-gray-300" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white px-3 py-2 rounded-lg shadow-lg border text-xs">
      <p className="text-gray-500 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name.includes("Revenue") ? formatPrice(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState("30d");
  const [summary, setSummary] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [popular, setPopular] = useState<any>(null);
  const [hourly, setHourly] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [sumRes, revRes, popRes, hourRes] = await Promise.all([
      fetch(`/api/reports?type=summary&period=${period}`),
      fetch(`/api/reports?type=revenue&period=${period}`),
      fetch(`/api/reports?type=popular_items&period=${period}`),
      fetch(`/api/reports?type=hourly&period=${period}`),
    ]);
    if (sumRes.ok) setSummary(await sumRes.json());
    if (revRes.ok) setRevenue(await revRes.json());
    if (popRes.ok) setPopular(await popRes.json());
    if (hourRes.ok) setHourly(await hourRes.json());
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Set default export range
  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    setExportFrom(from.toISOString().split("T")[0]);
    setExportTo(now.toISOString().split("T")[0]);
  }, []);

  const downloadCSV = () => {
    const url = `/api/orders/export?from=${exportFrom}&to=${exportTo}`;
    window.open(url, "_blank");
  };

  // Prepare chart data
  const revenueData = (revenue?.chart || []).map((d: any) => ({
    ...d,
    revenue: d.revenue / 100, // Convert pence to pounds for display
  }));

  const orderTypeData = summary ? [
    { name: "Delivery", value: summary.delivery_orders || 0 },
    { name: "Collection", value: summary.collection_orders || 0 },
  ].filter(d => d.value > 0) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Revenue, popular items, and order analytics.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={cn("px-3 py-1.5 text-xs rounded-md font-medium transition-colors",
                period === p.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Revenue" value={formatPrice(summary?.total_revenue || 0)} icon={PoundSterling}
              sub={`${summary?.total_orders || 0} orders`} />
            <StatCard label="Avg Order" value={formatPrice(summary?.avg_order_value || 0)} icon={TrendingUp} />
            <StatCard label="Delivery" value={`${summary?.delivery_orders || 0}`} icon={Truck}
              sub={`fees: ${formatPrice(summary?.total_delivery_fees || 0)}`} />
            <StatCard label="Collection" value={`${summary?.collection_orders || 0}`} icon={Store} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Customers" value={`${summary?.total_customers || 0}`} icon={Users} />
            <StatCard label="Discounts Given" value={formatPrice(summary?.total_discounts || 0)} icon={Tag} />
            <StatCard label="Refunds" value={`${summary?.refunded_orders || 0}`} icon={ArrowDown} />
            <StatCard label="VAT Collected" value={formatPrice(summary?.total_vat || 0)} icon={PoundSterling} />
          </div>

          {/* Revenue Line Chart (Recharts) */}
          <div className="card p-5 mb-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-400" /> Daily Revenue
            </h3>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `£${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#1B4F72" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-sm text-gray-400 py-8">No revenue data for this period.</div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Popular items bar chart */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-gray-400" /> Top Items
              </h3>
              {(popular?.items || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={(popular?.items || []).slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="quantity" name="Sold" fill="#1B4F72" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-sm text-gray-400 py-8">No item data.</div>
              )}
            </div>

            {/* Order type pie chart + hourly bar */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" /> Orders by Hour
              </h3>
              {(hourly?.chart || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourly?.chart || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="orders" name="Orders" fill="#2E86C1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-sm text-gray-400 py-8">No hourly data.</div>
              )}

              {/* Mini pie chart */}
              {orderTypeData.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs text-gray-500 mb-2">Delivery vs Collection</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={orderTypeData} cx="50%" cy="50%" innerRadius={30} outerRadius={50}
                        dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {orderTypeData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Export section */}
          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Download className="h-4 w-4 text-gray-400" /> Export Data
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">From</label>
                <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)}
                  className="input-field text-sm py-1.5 px-3" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">To</label>
                <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)}
                  className="input-field text-sm py-1.5 px-3" />
              </div>
              <button onClick={downloadCSV} className="btn-primary text-sm flex items-center gap-2">
                <Download className="h-4 w-4" /> Download CSV
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
