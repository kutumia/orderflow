"use client";

import { useState } from "react";
import Link from "next/link";
import { Code2, ChevronRight, Copy, CheckCircle2, Printer, Zap, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative bg-gray-900 text-gray-100 rounded-lg overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 text-gray-400 text-[10px]">
        <span>{lang}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="hover:text-gray-200">{copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</button>
      </div>
      <pre className="p-3 overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}

const ENDPOINTS = [
  {
    method: "GET", path: "/api/pb/v1/poll", desc: "Fetch queued print jobs for your restaurant",
    params: "device_id (optional) — filter by specific device",
    response: `{ "jobs": [{ "id": "...", "status": "queued", "receipt_data": "...", "priority": 1 }] }`,
  },
  {
    method: "POST", path: "/api/pb/v1/poll", desc: "Report job completion or failure",
    body: `{ "job_id": "...", "status": "printed|failed", "error_message": "..." }`,
    response: `{ "job": { "id": "...", "status": "printed" } }`,
  },
  {
    method: "POST", path: "/api/pb/v1/heartbeat", desc: "Agent heartbeat — registers/updates device",
    body: `{ "device_id": "...", "printer_name": "Epson TM-T20", "paper_width": 80 }`,
    response: `{ "ok": true, "server_time": "2025-01-01T00:00:00Z" }`,
  },
  {
    method: "POST", path: "/api/pb/v1/jobs", desc: "Create a new print job",
    body: `{ "receipt_data": "Order #123\\n...", "device_id": "...", "priority": 1 }`,
    response: `{ "job": { "id": "...", "status": "queued" } }`,
  },
  {
    method: "GET", path: "/api/pb/v1/jobs", desc: "List print jobs",
    params: "status (optional), limit (optional, max 100)",
    response: `{ "jobs": [...] }`,
  },
  {
    method: "GET", path: "/api/pb/v1/jobs/:id", desc: "Get a single job by ID",
    response: `{ "job": { "id": "...", "status": "printed", "printed_at": "..." } }`,
  },
  {
    method: "GET", path: "/api/pb/v1/devices", desc: "List connected printer devices",
    response: `{ "devices": [{ "id": "...", "device_name": "Kitchen", "is_online": true }] }`,
  },
  {
    method: "GET", path: "/api/pb/v1/webhooks", desc: "List recent webhook delivery attempts",
    response: `{ "deliveries": [{ "event": "job.printed", "status": "delivered" }] }`,
  },
  {
    method: "POST", path: "/api/pb/v1/webhooks", desc: "Send a test webhook",
    response: `{ "success": true, "status_code": 200 }`,
  },
];

export default function PrintBridgeDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold">PrintBridge API</span>
          </div>
          <Link href="/printbridge" className="btn-primary text-sm">Get API Key →</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-3">PrintBridge API Reference</h1>
          <p className="text-gray-500 text-lg">Send receipts to thermal printers anywhere. REST API with webhook notifications.</p>
        </div>

        {/* Quick start */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Quick Start</h2>
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <p className="text-sm text-gray-600">Get printing in 5 minutes:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="h-6 w-6 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <div><p className="text-sm font-medium">Get your API key</p><p className="text-xs text-gray-400">From your OrderFlow dashboard or <Link href="/printbridge" className="text-brand-600">printbridge page</Link></p></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="h-6 w-6 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <div>
                  <p className="text-sm font-medium">Create a print job</p>
                  <CodeBlock lang="bash" code={`curl -X POST https://orderflow.co.uk/api/pb/v1/jobs \\
  -H "X-API-Key: pb_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"receipt_data": "Order #123\\nChicken Tikka x2  £15.00\\nTotal: £15.00"}'`} />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="h-6 w-6 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <div><p className="text-sm font-medium">Download the printer agent</p><p className="text-xs text-gray-400">Install on your Windows PC with a thermal printer connected. Jobs print automatically.</p></div>
              </div>
            </div>
          </div>
        </section>

        {/* Auth */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Authentication</h2>
          <div className="bg-white rounded-xl border p-6">
            <p className="text-sm text-gray-600 mb-3">All requests require an API key in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">X-API-Key</code> header:</p>
            <CodeBlock lang="http" code={`GET /api/pb/v1/devices HTTP/1.1
Host: orderflow.co.uk
X-API-Key: pb_live_abc123...`} />
          </div>
        </section>

        {/* Rate limits */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Rate Limits</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-3 text-left">Plan</th><th className="p-3 text-left">Jobs/month</th><th className="p-3 text-left">Devices</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="p-3">Free</td><td className="p-3">500</td><td className="p-3">1</td></tr>
                <tr><td className="p-3">Starter</td><td className="p-3">5,000</td><td className="p-3">3</td></tr>
                <tr><td className="p-3">Pro</td><td className="p-3">Unlimited</td><td className="p-3">Unlimited</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">Rate limit exceeded → 429 with <code className="bg-gray-100 px-1 rounded">Retry-After</code> header. Usage resets monthly.</p>
        </section>

        {/* Endpoints */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Endpoints</h2>
          <div className="space-y-4">
            {ENDPOINTS.map((ep, i) => (
              <div key={i} className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded",
                    ep.method === "GET" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                  )}>{ep.method}</span>
                  <code className="text-sm font-mono">{ep.path}</code>
                </div>
                <p className="text-sm text-gray-600 mb-3">{ep.desc}</p>
                {ep.params && <p className="text-xs text-gray-400 mb-2"><strong>Params:</strong> {ep.params}</p>}
                {ep.body && <><p className="text-xs text-gray-400 mb-1"><strong>Body:</strong></p><CodeBlock lang="json" code={ep.body} /></>}
                <p className="text-xs text-gray-400 mt-2 mb-1"><strong>Response:</strong></p>
                <CodeBlock lang="json" code={ep.response} />
              </div>
            ))}
          </div>
        </section>

        {/* Webhooks */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Webhooks</h2>
          <div className="bg-white rounded-xl border p-6 space-y-3">
            <p className="text-sm text-gray-600">When a job reaches a terminal state, we POST to your configured webhook URL:</p>
            <CodeBlock lang="json" code={`{
  "event": "job.printed",  // or "job.failed"
  "job_id": "uuid",
  "status": "printed",
  "device_id": "device-uuid",
  "order_id": "order-uuid",
  "timestamp": "2025-01-01T12:00:00Z"
}`} />
            <div className="text-xs text-gray-400 space-y-1">
              <p><strong>Events:</strong> <code className="bg-gray-100 px-1 rounded">job.printed</code>, <code className="bg-gray-100 px-1 rounded">job.failed</code>, <code className="bg-gray-100 px-1 rounded">test</code></p>
              <p><strong>Retries:</strong> 3 attempts with exponential backoff (5s, 30s, 5min)</p>
              <p><strong>Headers:</strong> <code className="bg-gray-100 px-1 rounded">X-OrderFlow-Event: job.printed</code></p>
            </div>
          </div>
        </section>

        {/* Errors */}
        <section>
          <h2 className="text-xl font-bold mb-4">Error Codes</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-3 text-left">Code</th><th className="p-3 text-left">Meaning</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="p-3"><code>401</code></td><td className="p-3">Invalid or missing API key</td></tr>
                <tr><td className="p-3"><code>400</code></td><td className="p-3">Invalid request body or missing required fields</td></tr>
                <tr><td className="p-3"><code>404</code></td><td className="p-3">Job or resource not found</td></tr>
                <tr><td className="p-3"><code>429</code></td><td className="p-3">Monthly rate limit exceeded</td></tr>
                <tr><td className="p-3"><code>500</code></td><td className="p-3">Internal server error</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
