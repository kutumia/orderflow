"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Tag, Plus, Loader2, Trash2, ToggleLeft, ToggleRight,
  Percent, PoundSterling, Truck, Calendar, Hash, Users,
  AlertTriangle, X, CheckCircle2,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  percentage: { label: "Percentage Off", icon: Percent, color: "bg-blue-50 text-blue-700" },
  fixed: { label: "Fixed Amount", icon: PoundSterling, color: "bg-green-50 text-green-700" },
  free_delivery: { label: "Free Delivery", icon: Truck, color: "bg-purple-50 text-purple-700" },
};

function PromoCard({ promo, onToggle, onDelete }: {
  promo: any;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const typeConf = TYPE_CONFIG[promo.type] || TYPE_CONFIG.percentage;
  const Icon = typeConf.icon;
  const isExpired = promo.expiry && new Date(promo.expiry) < new Date();
  const isMaxed = promo.max_uses && promo.use_count >= promo.max_uses;

  const valueLabel = promo.type === "percentage"
    ? `${promo.value}% off`
    : promo.type === "fixed"
    ? `${formatPrice(promo.value)} off`
    : "Free delivery";

  return (
    <div className={cn("card p-4", !promo.is_active && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", typeConf.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-bold bg-gray-100 px-2 py-0.5 rounded">{promo.code}</code>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", typeConf.color)}>
              {valueLabel}
            </span>
            {!promo.is_active && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Disabled</span>
            )}
            {isExpired && (
              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Expired</span>
            )}
            {isMaxed && (
              <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">Fully used</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-2">
            {promo.min_order > 0 && (
              <span>Min order: {formatPrice(promo.min_order)}</span>
            )}
            {promo.expiry && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Expires: {new Date(promo.expiry).toLocaleDateString("en-GB")}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Used: {promo.use_count}{promo.max_uses ? `/${promo.max_uses}` : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={promo.is_active ? "Disable" : "Enable"}
          >
            {promo.is_active
              ? <ToggleRight className="h-5 w-5 text-success-500" />
              : <ToggleLeft className="h-5 w-5 text-gray-300" />
            }
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: any) => void;
}) {
  const [form, setForm] = useState({
    code: "",
    type: "percentage" as "percentage" | "fixed" | "free_delivery",
    value: "",
    min_order: "",
    expiry: "",
    max_uses: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleCreate = async () => {
    setSaving(true);
    setError("");

    const payload: any = {
      code: form.code,
      type: form.type,
      value: form.type === "percentage"
        ? parseInt(form.value) || 0
        : Math.round(parseFloat(form.value || "0") * 100),
      min_order: form.min_order
        ? Math.round(parseFloat(form.min_order) * 100)
        : 0,
      expiry: form.expiry || null,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
    };

    const res = await fetch("/api/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      onCreate(data);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create promo code");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-lg">Create Promo Code</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Code */}
          <div>
            <label className="label">Code *</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input className="input-field pl-10 uppercase" placeholder="e.g. WELCOME20"
                value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="label">Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {(["percentage", "fixed", "free_delivery"] as const).map((t) => {
                const conf = TYPE_CONFIG[t];
                const TIcon = conf.icon;
                return (
                  <button
                    key={t}
                    onClick={() => set("type", t)}
                    className={cn(
                      "p-3 rounded-lg border text-center text-xs font-medium transition-colors",
                      form.type === t
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <TIcon className="h-4 w-4 mx-auto mb-1" />
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Value */}
          {form.type !== "free_delivery" && (
            <div>
              <label className="label">
                {form.type === "percentage" ? "Discount (%)" : "Discount Amount (£)"}
              </label>
              <div className="relative">
                {form.type === "percentage" ? (
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                ) : (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                )}
                <input
                  type="number"
                  min="0"
                  max={form.type === "percentage" ? "100" : undefined}
                  step={form.type === "percentage" ? "1" : "0.01"}
                  className={cn("input-field", form.type === "fixed" && "pl-7")}
                  placeholder={form.type === "percentage" ? "20" : "5.00"}
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Min Order */}
          <div>
            <label className="label">Minimum Order (£) — optional</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
              <input type="number" step="0.01" min="0" className="input-field pl-7"
                placeholder="0.00" value={form.min_order} onChange={(e) => set("min_order", e.target.value)} />
            </div>
          </div>

          {/* Expiry & Max Uses */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Expiry Date — optional</label>
              <input type="date" className="input-field"
                value={form.expiry} onChange={(e) => set("expiry", e.target.value)} />
            </div>
            <div>
              <label className="label">Max Uses — optional</label>
              <input type="number" min="1" className="input-field"
                placeholder="Unlimited" value={form.max_uses} onChange={(e) => set("max_uses", e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="bg-danger-50 text-danger-500 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />{error}
            </div>
          )}
        </div>

        <div className="p-5 border-t flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Creating..." : "Create Code"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPromos = useCallback(async () => {
    const res = await fetch("/api/promo-codes");
    if (res.ok) setPromos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchPromos(); }, [fetchPromos]);

  const togglePromo = async (id: string, isActive: boolean) => {
    await fetch("/api/promo-codes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !isActive }),
    });
    fetchPromos();
  };

  const deletePromo = async (id: string, code: string) => {
    if (!confirm(`Delete promo code "${code}"? This cannot be undone.`)) return;
    await fetch(`/api/promo-codes?id=${id}`, { method: "DELETE" });
    fetchPromos();
  };

  const activeCount = promos.filter((p) => p.is_active).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-gray-500 text-sm mt-1">
            {promos.length} code{promos.length !== 1 ? "s" : ""} · {activeCount} active
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create Code
        </button>
      </div>

      {/* Quick examples */}
      {promos.length === 0 && !loading && (
        <div className="card p-5 mb-6 bg-brand-50 border-brand-200">
          <h3 className="font-medium text-sm text-brand-700 mb-2">💡 Promo Code Ideas</h3>
          <div className="grid grid-cols-3 gap-3 text-xs text-brand-600">
            <div className="bg-white rounded-lg p-3">
              <span className="font-bold">WELCOME20</span>
              <p className="text-gray-500 mt-1">20% off first order</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <span className="font-bold">FREEDELIVERY</span>
              <p className="text-gray-500 mt-1">Free delivery over £15</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <span className="font-bold">SAVE5</span>
              <p className="text-gray-500 mt-1">£5 off orders over £25</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : promos.length === 0 ? (
        <div className="card p-12 text-center">
          <Tag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm mb-4">No promo codes yet.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            Create Your First Code
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              onToggle={() => togglePromo(p.id, p.is_active)}
              onDelete={() => deletePromo(p.id, p.code)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(data) => {
            setPromos((prev) => [data, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
