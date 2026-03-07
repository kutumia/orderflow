"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { HelpWidget } from "@/components/dashboard/HelpWidget";
import { Loader2, Menu, X, Eye } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [impersonating, setImpersonating] = useState<any>(null);

  // Check for impersonation state
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("impersonating");
      if (stored) setImpersonating(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const exitImpersonation = async () => {
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exit" }),
    });
    sessionStorage.removeItem("impersonating");
    setImpersonating(null);
    router.push("/admin");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  const user = session.user as any;
  const restaurantName = impersonating?.restaurant_name || user.restaurant_name || "My Restaurant";
  const restaurantSlug = impersonating?.restaurant_slug || user.restaurant_slug || "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-y-0 left-0 w-64 z-50 animate-in slide-in-from-left" onClick={(e) => e.stopPropagation()}>
            <Sidebar
              restaurantName={restaurantName}
              restaurantSlug={restaurantSlug}
              userRole={user.role || "owner"}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          restaurantName={restaurantName}
          restaurantSlug={restaurantSlug}
          userRole={user.role || "owner"}
        />
      </div>

      {/* Main content area */}
      <main className="lg:ml-64 min-h-screen">
        {/* Impersonation banner */}
        {impersonating && (
          <div className="bg-red-600 text-white text-sm text-center py-2 px-4 flex items-center justify-center gap-3">
            <Eye className="h-4 w-4" />
            <span>Viewing as <strong>{impersonating.restaurant_name}</strong></span>
            <button onClick={exitImpersonation}
              className="px-3 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-medium">
              Exit Impersonation
            </button>
          </div>
        )}

        {/* Trial banner */}
        {!impersonating && user.subscription_status === "trialing" && (
          <div className="bg-brand-600 text-white text-sm text-center py-2 px-4">
            You&apos;re on a free trial.{" "}
            <a href="/dashboard/billing" className="underline font-medium">
              Upgrade now
            </a>{" "}
            to keep your restaurant live.
          </div>
        )}

        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm truncate flex-1">{restaurantName}</span>
          <HelpWidget />
        </div>

        {/* Desktop help button (top-right) */}
        <div className="hidden lg:flex items-center justify-end px-8 pt-4">
          <HelpWidget />
        </div>

        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
