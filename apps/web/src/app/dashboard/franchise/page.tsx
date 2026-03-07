"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2, MapPin, Plus, TrendingUp, ShoppingBag, PoundSterling,
  Users, Copy, CheckCircle2, Loader2, ArrowRight, AlertTriangle,
  FileText, X,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: string;
  address: string;
  is_current: boolean;
}

export default function FranchisePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(searchParams.get("add") === "true");
  const [templates, setTemplates] = useState<any[]>([]);

  // Add location form
  const [newLoc, setNewLoc] = useState({ name: "", slug: "", address: "", postcode: "", clone_from: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/menu-templates").then((r) => r.json()),
    ]).then(([locData, tmplData]) => {
      setLocations(locData.locations || []);
      setTemplates(tmplData.templates || []);
      // Fetch stats for each location
      // In real implementation this would be a consolidated API call
    }).finally(() => setLoading(false));
  }, []);

  const handleAddLocation = async () => {
    if (!newLoc.name || !newLoc.slug) { setAddError("Name and slug required"); return; }
    setAdding(true); setAddError("");
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLoc.name,
          slug: newLoc.slug,
          address: newLoc.address,
          postcode: newLoc.postcode,
          clone_from_restaurant_id: newLoc.clone_from || undefined,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        window.location.reload();
      } else {
        const data = await res.json();
        setAddError(data.error || "Failed to create location");
      }
    } catch { setAddError("Something went wrong"); }
    setAdding(false);
  };

  const switchTo = async (id: string) => {
    await fetch("/api/locations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: id }),
    });
    window.location.href = "/dashboard";
  };

  const saveTemplate = async () => {
    const name = prompt("Template name:");
    if (!name) return;
    await fetch("/api/menu-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const res = await fetch("/api/menu-templates");
    const data = await res.json();
    setTemplates(data.templates || []);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Franchise</h1>
          <p className="text-sm text-gray-500 mt-1">
            {locations.length} location{locations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Location
        </button>
      </div>

      {/* Locations Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {locations.map((loc) => (
          <div key={loc.id} className={cn("card p-5 hover:border-brand-200 transition-colors cursor-pointer", loc.is_current && "ring-2 ring-brand-200")}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{loc.name}</h3>
                <p className="text-xs text-gray-400">/{loc.slug}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", loc.is_active ? "bg-success-500" : "bg-gray-300")} />
                <span className="text-[10px] text-gray-400">{loc.is_active ? "Live" : "Draft"}</span>
              </div>
            </div>
            {loc.address && (
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" /> {loc.address}
              </p>
            )}
            <div className="flex gap-2">
              {loc.is_current ? (
                <span className="text-xs text-brand-600 bg-brand-50 px-2 py-1 rounded">Current</span>
              ) : (
                <button onClick={() => switchTo(loc.id)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  Switch to this location →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Menu Templates */}
      <div className="card p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Menu Templates</h3>
            <p className="text-xs text-gray-400 mt-0.5">Save your menu as a template and apply it to other locations.</p>
          </div>
          <button onClick={saveTemplate} className="btn-secondary text-sm flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Save Current Menu
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No templates yet. Save your current menu to create one.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.category_count} categories · {t.item_count} items</p>
                </div>
                <button
                  onClick={async () => {
                    const targetId = prompt("Enter restaurant ID to apply template to:");
                    if (!targetId) return;
                    await fetch("/api/menu-templates", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ template_id: t.id, target_restaurant_id: targetId }),
                    });
                    alert("Template applied!");
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Apply →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cross-Location Tips */}
      {locations.length > 1 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Multi-Location Tips</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Use the restaurant switcher in the sidebar to quickly switch between locations.</p>
            <p>• Save menu templates to keep consistent menus across all locations.</p>
            <p>• Each location has its own Stripe Connect account for separate payouts.</p>
            <p>• Reports are per-location. Switch locations to view each one's performance.</p>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowAddModal(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Location</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Restaurant Name *</label>
                <input className="input-field" value={newLoc.name} onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                  placeholder="e.g. Mario's Pizzeria — City Centre" />
              </div>
              <div>
                <label className="label">URL Slug *</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">orderflow.co.uk/</span>
                  <input className="input-field flex-1" value={newLoc.slug}
                    onChange={(e) => setNewLoc({ ...newLoc, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                    placeholder="marios-city-centre" />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <input className="input-field" value={newLoc.address} onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })}
                  placeholder="123 High Street" />
              </div>
              <div>
                <label className="label">Postcode</label>
                <input className="input-field" value={newLoc.postcode} onChange={(e) => setNewLoc({ ...newLoc, postcode: e.target.value })} />
              </div>
              <div>
                <label className="label">Copy Menu From</label>
                <select className="input-field" value={newLoc.clone_from} onChange={(e) => setNewLoc({ ...newLoc, clone_from: e.target.value })}>
                  <option value="">Start with empty menu</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <button onClick={handleAddLocation} disabled={adding} className="btn-primary w-full flex items-center justify-center gap-2">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Create Location</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
