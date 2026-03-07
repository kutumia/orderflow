"use client";

import Link from "next/link";
import { Printer, Download, Code2, Shield, Zap, Globe, ArrowRight, CheckCircle2 } from "lucide-react";

const FEATURES = [
  { icon: Printer, title: "Thermal Printing", desc: "ESC/POS support for 80mm and 58mm receipt printers. USB and network." },
  { icon: Zap, title: "Instant Delivery", desc: "Jobs queued and printed in under 2 seconds. Priority-based ordering." },
  { icon: Shield, title: "Reliable", desc: "Automatic retries, SMS/email fallback if printing fails after 3 attempts." },
  { icon: Globe, title: "API Access", desc: "RESTful API to create print jobs from any system. Webhook notifications." },
];

export default function PrintBridgePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold">PrintBridge</span>
          </div>
          <Link href="/docs/printbridge" className="text-sm text-gray-600 hover:text-gray-900">API Docs →</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="h-16 w-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Printer className="h-8 w-8 text-brand-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">PrintBridge</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Cloud print service for thermal receipt printers. Send orders from any system — they print instantly in your kitchen.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border">
              <div className="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center mb-3">
                <f.icon className="h-5 w-5 text-brand-600" />
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Download + Actions */}
        <div className="bg-white rounded-2xl border p-8 mb-12">
          <h2 className="text-xl font-bold mb-6 text-center">Get Started</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <a href="/downloads/OrderFlowPrinter-Setup.exe"
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-brand-50 hover:bg-brand-100 transition-colors text-center">
              <Download className="h-8 w-8 text-brand-600" />
              <div>
                <p className="font-semibold text-sm">Download Agent</p>
                <p className="text-xs text-gray-500">Windows 10/11</p>
              </div>
            </a>
            <Link href="/docs/printbridge"
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-center">
              <Code2 className="h-8 w-8 text-gray-600" />
              <div>
                <p className="font-semibold text-sm">API Documentation</p>
                <p className="text-xs text-gray-500">REST API reference</p>
              </div>
            </Link>
            <Link href="/register"
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-green-50 hover:bg-green-100 transition-colors text-center">
              <Zap className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-semibold text-sm">Get API Key</p>
                <p className="text-xs text-gray-500">Free tier: 500 jobs/mo</p>
              </div>
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-6 text-center">How It Works</h2>
          <div className="space-y-4">
            {[
              { step: "1", title: "Your system creates a print job", desc: "POST receipt data to the PrintBridge API. Plain text, formatted for thermal printers." },
              { step: "2", title: "Agent polls for jobs", desc: "The PrintBridge agent runs on your Windows PC, polling for new jobs every 2 seconds." },
              { step: "3", title: "Receipt prints instantly", desc: "The agent sends the receipt to your thermal printer via USB or network. Job marked as printed." },
              { step: "4", title: "Webhook confirms delivery", desc: "Your system receives a webhook notification when the job is printed (or if it fails)." },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-4 bg-white rounded-xl border p-5">
                <div className="h-8 w-8 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{s.step}</div>
                <div>
                  <p className="font-semibold text-sm">{s.title}</p>
                  <p className="text-sm text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link href="/register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
            Start Free <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-gray-400 mt-3">500 jobs/month free. No credit card required.</p>
        </div>
      </main>
    </div>
  );
}
