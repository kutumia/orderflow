"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, PoundSterling, TrendingUp, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

const BENEFITS = [
  { icon: PoundSterling, title: "20% Commission", desc: "Earn 20% of revenue for the first 6 months from every restaurant you refer." },
  { icon: Users, title: "Free for Clients", desc: "Your clients get a 14-day free trial and 50% off their first month." },
  { icon: TrendingUp, title: "Dashboard Tracking", desc: "Track signups, activations, and commission earned in real time." },
];

export default function PartnersPage() {
  const [form, setForm] = useState({ name: "", email: "", website: "", expected_referrals: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) { setError("Name and email required"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong");
      }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
          <Link href="/login" className="text-sm text-gray-600">Log in →</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Partner Program</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Earn recurring commission by referring restaurants to OrderFlow.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {BENEFITS.map((b, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border text-center">
              <div className="h-12 w-12 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <b.icon className="h-6 w-6 text-brand-600" />
              </div>
              <h3 className="font-semibold mb-1">{b.title}</h3>
              <p className="text-sm text-gray-500">{b.desc}</p>
            </div>
          ))}
        </div>

        {success ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border max-w-lg mx-auto text-center">
            <CheckCircle2 className="h-12 w-12 text-success-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Application Submitted!</h2>
            <p className="text-gray-500">We'll review your application and get back to you within 48 hours with your partner code and dashboard access.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-sm border max-w-lg mx-auto">
            <h2 className="text-xl font-bold mb-4">Apply to Become a Partner</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Agency / Company Name *</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. WebDesign Agency Ltd" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@agency.com" />
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input-field" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Expected Referrals / Month</label>
                <select className="input-field" value={form.expected_referrals} onChange={(e) => setForm({ ...form, expected_referrals: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="1-5">1–5</option>
                  <option value="5-10">5–10</option>
                  <option value="10-25">10–25</option>
                  <option value="25+">25+</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Submit Application</span> <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          </div>
        )}

        <div className="text-center mt-12 text-sm text-gray-400">
          <p>Already a partner? <Link href="/partners/dashboard" className="text-brand-600 hover:text-brand-700 font-medium">View your dashboard →</Link></p>
        </div>
      </main>
    </div>
  );
}
