"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, PoundSterling, TrendingUp, Copy, CheckCircle2, Loader2, Store, Clock } from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";

export default function PartnerDashboardPage() {
  const [code, setCode] = useState("");
  const [entered, setEntered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchDashboard = async (partnerCode: string) => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/partners?code=${partnerCode}`);
      if (res.ok) {
        setData(await res.json());
        setEntered(true);
      } else {
        setError("Partner code not found");
      }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  const referralUrl = data ? `https://orderflow.co.uk/register?ref=${data.partner.code}` : "";

  if (!entered) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
            <Link href="/partners" className="text-sm text-gray-600">Partner Program →</Link>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-20">
          <div className="bg-white rounded-xl border p-6 text-center">
            <Users className="h-10 w-10 text-brand-600 mx-auto mb-3" />
            <h1 className="text-xl font-bold mb-4">Partner Dashboard</h1>
            <p className="text-sm text-gray-500 mb-4">Enter your partner code to access your dashboard.</p>
            <div className="flex gap-2">
              <input className="input-field flex-1" placeholder="OF-XXXX-XXXXXX" value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && fetchDashboard(code)} />
              <button onClick={() => fetchDashboard(code)} disabled={loading || !code} className="btn-primary text-sm shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "View"}
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{data.partner.name}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
              data.partner.status === "approved" ? "bg-success-50 text-success-600" :
              data.partner.status === "pending" ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
            )}>{data.partner.status}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Signups", value: data.stats.total_signups, icon: Users },
            { label: "Active Restaurants", value: data.stats.active_restaurants, icon: Store },
            { label: "Commission Earned", value: formatPrice(data.stats.total_commission), icon: PoundSterling },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <span className="text-2xl font-bold">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Referral link */}
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-sm mb-3">Your Referral Link</h3>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-gray-50 border rounded-lg px-3 py-2 flex-1 select-all truncate">{referralUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(referralUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="btn-secondary text-sm shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Share this link with restaurants. When they sign up and pay, you earn 20% commission for 6 months.</p>
        </div>

        {/* Referrals table */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">Referred Restaurants</h3>
          </div>
          {data.referrals.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No referrals yet. Share your link to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="p-3 text-left">Restaurant</th>
                  <th className="p-3 text-left">Signed Up</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.referrals.map((ref: any) => (
                  <tr key={ref.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{ref.restaurant_name || "—"}</td>
                    <td className="p-3 text-gray-500">{new Date(ref.signed_up_at).toLocaleDateString("en-GB")}</td>
                    <td className="p-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full",
                        ref.activated_at ? "bg-success-50 text-success-600" : "bg-yellow-50 text-yellow-600"
                      )}>{ref.activated_at ? "Active" : "Trial"}</span>
                    </td>
                    <td className="p-3 text-right font-medium">{formatPrice(ref.total_commission || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
