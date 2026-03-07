"use client";

import { useState, useEffect } from "react";
import {
  Users, Gift, Copy, CheckCircle2, Loader2, Share2,
  MessageCircle, Mail, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReferralsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  const url = data?.referral_url || "";
  const code = data?.code || "";

  const shareText = `I use OrderFlow for online ordering — no commission! Sign up with my link and get 50% off your first month: ${url}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Refer a Restaurant</h1>
        <p className="text-sm text-gray-500 mt-1">Earn a free month for every restaurant you refer.</p>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { icon: Share2, title: "Share your link", desc: "Send to other restaurant owners" },
          { icon: Users, title: "They sign up", desc: "They get 50% off first month" },
          { icon: Gift, title: "You get rewarded", desc: "1 free month when they pay" },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center">
            <s.icon className="h-6 w-6 text-brand-600 mx-auto mb-2" />
            <p className="text-sm font-semibold">{s.title}</p>
            <p className="text-xs text-gray-400">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Referred", value: data?.stats?.total_signups || 0 },
          { label: "Activated", value: data?.stats?.active || 0 },
          { label: "Rewards Earned", value: data?.stats?.rewards_earned || 0 },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-sm mb-3">Your Referral Link</h3>
        <div className="flex items-center gap-2 mb-4">
          <code className="text-xs bg-gray-50 border rounded-lg px-3 py-2.5 flex-1 select-all truncate font-mono">{url}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="btn-secondary text-sm shrink-0 flex items-center gap-1.5"
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="flex gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank" rel="noopener"
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a
            href={`mailto:?subject=Try OrderFlow — no commission online ordering&body=${encodeURIComponent(shareText)}`}
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            <Mail className="h-4 w-4" /> Email
          </a>
          <button
            onClick={() => { if (navigator.share) navigator.share({ title: "OrderFlow", text: shareText, url }); else { navigator.clipboard.writeText(url); setCopied(true); } }}
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-gray-50 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </div>

      {/* Referral code */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Your Referral Code</h3>
            <p className="text-xs text-gray-400 mt-0.5">Share this code directly — they enter it at signup.</p>
          </div>
          <code className="text-lg font-bold font-mono text-brand-600">{code}</code>
        </div>
      </div>

      {/* Signups table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Referred Restaurants</h3>
        </div>
        {(!data?.signups || data.signups.length === 0) ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No referrals yet. Share your link to get started!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Signed Up</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.signups.map((s: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-3">{s.email || "—"}</td>
                  <td className="p-3 text-gray-500">{new Date(s.signed_up_at).toLocaleDateString("en-GB")}</td>
                  <td className="p-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full",
                      s.activated ? "bg-success-50 text-success-600" : "bg-yellow-50 text-yellow-600"
                    )}>{s.activated ? "Active" : "Trial"}</span>
                  </td>
                  <td className="p-3">
                    {s.rewarded ? <CheckCircle2 className="h-4 w-4 text-success-500" /> : <span className="text-xs text-gray-400">Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
