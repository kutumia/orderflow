"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "down" | "checking";
  latency?: number;
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Ordering Platform", status: "checking" },
    { name: "Payment Processing", status: "checking" },
    { name: "Kitchen Printing", status: "checking" },
    { name: "Dashboard & Admin", status: "checking" },
  ]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = async () => {
    setServices((s) => s.map((svc) => ({ ...svc, status: "checking" })));
    try {
      const start = Date.now();
      const res = await fetch("/api/health");
      const latency = Date.now() - start;

      if (res.ok) {
        const data = await res.json();
        setServices([
          { name: "Ordering Platform", status: data.status === "healthy" ? "operational" : "degraded", latency },
          { name: "Payment Processing", status: "operational", latency },
          { name: "Kitchen Printing", status: data.printer_bridge === false ? "degraded" : "operational" },
          { name: "Dashboard & Admin", status: "operational", latency },
        ]);
      } else {
        setServices((s) => s.map((svc) => ({ ...svc, status: "degraded" })));
      }
    } catch {
      setServices((s) => s.map((svc) => ({ ...svc, status: "down" })));
    }
    setLastChecked(new Date());
  };

  useEffect(() => { checkStatus(); }, []);

  const allOk = services.every((s) => s.status === "operational");
  const anyDown = services.some((s) => s.status === "down");

  const statusConfig = {
    operational: { icon: CheckCircle2, color: "text-success-500", bg: "bg-success-50", label: "Operational" },
    degraded: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50", label: "Degraded" },
    down: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "Down" },
    checking: { icon: Loader2, color: "text-gray-400", bg: "bg-gray-50", label: "Checking..." },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
          <span className="text-sm text-gray-500">System Status</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Overall status */}
        <div className={cn("rounded-xl p-6 mb-8 text-center",
          allOk ? "bg-success-50 border border-success-100" :
          anyDown ? "bg-red-50 border border-red-100" :
          "bg-yellow-50 border border-yellow-100"
        )}>
          {allOk ? (
            <><CheckCircle2 className="h-8 w-8 text-success-500 mx-auto mb-2" /><h1 className="text-xl font-bold text-success-700">All Systems Operational</h1></>
          ) : anyDown ? (
            <><XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" /><h1 className="text-xl font-bold text-red-700">Service Disruption</h1></>
          ) : (
            <><AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" /><h1 className="text-xl font-bold text-yellow-700">Partial Degradation</h1></>
          )}
          {lastChecked && <p className="text-xs text-gray-500 mt-2">Last checked: {lastChecked.toLocaleTimeString("en-GB")}</p>}
        </div>

        {/* Services */}
        <div className="bg-white rounded-xl border overflow-hidden mb-6">
          {services.map((svc, i) => {
            const cfg = statusConfig[svc.status];
            return (
              <div key={svc.name} className={cn("flex items-center justify-between p-4", i > 0 && "border-t")}>
                <span className="text-sm font-medium">{svc.name}</span>
                <div className="flex items-center gap-2">
                  {svc.latency && <span className="text-[10px] text-gray-400">{svc.latency}ms</span>}
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full", cfg.bg, cfg.color)}>
                    <cfg.icon className={cn("h-3 w-3", svc.status === "checking" && "animate-spin")} />
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button onClick={checkStatus} className="text-sm text-brand-600 hover:text-brand-700 inline-flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="mt-12 text-center text-xs text-gray-400">
          <p>Need help? Email <a href="mailto:support@orderflow.co.uk" className="text-brand-600">support@orderflow.co.uk</a></p>
        </div>
      </main>
    </div>
  );
}
