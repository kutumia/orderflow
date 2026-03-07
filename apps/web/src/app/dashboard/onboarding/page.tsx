"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Store, UtensilsCrossed, Truck, CreditCard, Rocket,
  Loader2, ArrowRight, ArrowLeft, Check, Upload, Plus,
  Trash2, Copy, CheckCircle2, ChevronRight, PartyPopper,
  ExternalLink, Printer, Clock,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";

const STEPS = [
  { id: "profile", label: "Restaurant Profile", icon: Store },
  { id: "menu", label: "Menu Setup", icon: UtensilsCrossed },
  { id: "delivery", label: "Delivery & Hours", icon: Truck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "golive", label: "Go Live", icon: Rocket },
];

const CUISINE_TYPES = [
  "Indian", "Chinese", "Italian", "Pizza", "Burgers", "Fish & Chips",
  "Thai", "Turkish", "Mexican", "Japanese", "Korean", "American",
  "Caribbean", "Middle Eastern", "Vegan", "Other",
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user as any;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Step 1: Profile
  const [profile, setProfile] = useState({
    name: "", cuisine: "", phone: "", address: "", postcode: "", logo_url: "",
  });

  // Step 2: Menu
  const [categories, setCategories] = useState<{ name: string; items: { name: string; price: number; description: string }[] }[]>([]);
  const [importMode, setImportMode] = useState<"manual" | "import">("manual");
  const [importJson, setImportJson] = useState("");

  // Step 3: Delivery
  const [delivery, setDelivery] = useState({
    delivery_enabled: true, collection_enabled: true,
    delivery_fee: 299, min_order: 1000, delivery_radius: 3,
  });
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    Object.fromEntries(DAYS.map((d) => [d, { open: "11:00", close: "22:00", closed: false }]))
  );

  // Step 4: Payments
  const [stripeConnected, setStripeConnected] = useState(false);

  // Step 5: Go-live
  const [checks, setChecks] = useState({ profile: false, menu: false, hours: false, stripe: false, printer: false });
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load existing data
  useEffect(() => {
    async function load() {
      try {
        const [progRes, settingsRes] = await Promise.all([
          fetch("/api/onboarding-progress"),
          fetch("/api/restaurant-settings"),
        ]);
        if (progRes.ok) {
          const prog = await progRes.json();
          setChecks({
            profile: prog.profile_complete || false,
            menu: (prog.menu_items || 0) >= 3,
            hours: (prog.hours_set || 0) > 0,
            stripe: prog.stripe_connected || false,
            printer: prog.printer_connected || false,
          });
          if (prog.onboarding_step) setStep(Math.min(prog.onboarding_step, 4));
        }
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          if (s.name) setProfile((p) => ({ ...p, name: s.name, phone: s.phone || "", address: s.address || "", postcode: s.postcode || "", cuisine: s.cuisine || "" }));
          setStripeConnected(s.stripe_connected || false);
          setDelivery((d) => ({
            ...d,
            delivery_enabled: s.delivery_enabled ?? true,
            collection_enabled: s.collection_enabled ?? true,
            delivery_fee: s.delivery_fee ?? 299,
            min_order: s.min_order ?? 1000,
          }));
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const saveStep = useCallback(async (nextStep: number) => {
    setSaving(true);
    try {
      // Save current step data
      if (step === 0) {
        await fetch("/api/restaurant-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...profile, onboarding_step: nextStep }),
        });
      } else if (step === 1 && categories.length > 0) {
        // Save categories + items
        for (const cat of categories) {
          const catRes = await fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: cat.name }),
          });
          if (catRes.ok) {
            const catData = await catRes.json();
            for (const item of cat.items) {
              await fetch("/api/menu-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  category_id: catData.id,
                  name: item.name,
                  price: item.price,
                  description: item.description,
                }),
              });
            }
          }
        }
        await fetch("/api/restaurant-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboarding_step: nextStep }),
        });
      } else if (step === 2) {
        await fetch("/api/restaurant-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...delivery, onboarding_step: nextStep }),
        });
        // Save hours
        await fetch("/api/hours", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hours: DAYS.map((day) => ({
              day,
              is_open: !hours[day].closed,
              open_time: hours[day].open,
              close_time: hours[day].close,
            })),
          }),
        });
      } else {
        await fetch("/api/restaurant-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboarding_step: nextStep }),
        });
      }
    } catch {}
    setSaving(false);
    setStep(nextStep);
  }, [step, profile, categories, delivery, hours]);

  const handleImportJson = () => {
    try {
      const data = JSON.parse(importJson);
      if (!Array.isArray(data)) throw new Error("Expected array");

      // Validate and deduplicate
      const seen = new Set<string>();
      const validated = data
        .filter((cat: any) => cat.name && typeof cat.name === "string")
        .map((cat: any) => {
          const catName = cat.name.trim().substring(0, 100);
          if (seen.has(catName.toLowerCase())) return null; // Skip duplicates
          seen.add(catName.toLowerCase());
          const itemSeen = new Set<string>();
          return {
            name: catName,
            items: (cat.items || [])
              .filter((item: any) => item.name && typeof item.name === "string")
              .filter((item: any) => {
                const key = item.name.trim().toLowerCase();
                if (itemSeen.has(key)) return false;
                itemSeen.add(key);
                return true;
              })
              .map((item: any) => ({
                name: item.name.trim().substring(0, 200),
                price: Math.max(0, Math.min(99999, parseInt(item.price) || 0)),
                description: (item.description || "").trim().substring(0, 500),
              })),
          };
        })
        .filter(Boolean);

      if (validated.length === 0) throw new Error("No valid categories found");
      setCategories(validated as any);
    } catch (err: any) {
      alert(err.message || "Invalid JSON format. Please check the structure.");
    }
  };

  const addCategory = () => setCategories([...categories, { name: "", items: [{ name: "", price: 0, description: "" }] }]);
  const removeCategory = (i: number) => setCategories(categories.filter((_, j) => j !== i));
  const addItem = (catIdx: number) => {
    const updated = [...categories];
    updated[catIdx].items.push({ name: "", price: 0, description: "" });
    setCategories(updated);
  };

  const goLive = async () => {
    setSaving(true);
    await fetch("/api/restaurant-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true, onboarding_step: 5 }),
    });
    setPublished(true);
    setSaving(false);
  };

  const orderUrl = `https://orderflow.co.uk/${user?.restaurant_slug || ""}`;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div key={s.id} className="flex-1 flex items-center gap-1">
              <button
                onClick={() => i <= step && setStep(i)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full",
                  active ? "bg-brand-50 text-brand-700" : done ? "bg-success-50 text-success-700" : "bg-gray-50 text-gray-400"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Profile */}
      {step === 0 && (
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Restaurant Profile</h2>
            <p className="text-sm text-gray-500 mt-1">Basic information shown to your customers.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Restaurant Name *</label>
              <input className="input-field" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="e.g. Mario's Pizzeria" />
            </div>
            <div>
              <label className="label">Cuisine Type</label>
              <select className="input-field" value={profile.cuisine} onChange={(e) => setProfile({ ...profile, cuisine: e.target.value })}>
                <option value="">Select...</option>
                {CUISINE_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Phone Number *</label>
              <input className="input-field" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="07xxx xxxxxx" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address *</label>
              <input className="input-field" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} placeholder="123 High Street, City" />
            </div>
            <div>
              <label className="label">Postcode *</label>
              <input className="input-field" value={profile.postcode} onChange={(e) => setProfile({ ...profile, postcode: e.target.value })} placeholder="HU1 1AA" />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Menu */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Menu Setup</h2>
            <p className="text-sm text-gray-500 mt-1">Add at least 3 items to continue. You can always edit later.</p>
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => setImportMode("manual")} className={cn("flex-1 p-3 rounded-lg border text-sm font-medium", importMode === "manual" ? "bg-brand-50 border-brand-300 text-brand-700" : "border-gray-200 text-gray-500")}>
              <Plus className="h-4 w-4 mx-auto mb-1" /> Add Manually
            </button>
            <button onClick={() => setImportMode("import")} className={cn("flex-1 p-3 rounded-lg border text-sm font-medium", importMode === "import" ? "bg-brand-50 border-brand-300 text-brand-700" : "border-gray-200 text-gray-500")}>
              <Upload className="h-4 w-4 mx-auto mb-1" /> Import Menu
            </button>
          </div>

          {importMode === "import" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Paste your menu as JSON. Format: <code className="bg-gray-100 px-1 text-xs rounded">[{`{"name":"Starters","items":[{"name":"Garlic Bread","price":450,"description":"With cheese"}]}`}]</code></p>
              <textarea className="input-field min-h-[120px] font-mono text-xs" value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder='[{"name":"Starters","items":[{"name":"Garlic Bread","price":450}]}]' />
              <button onClick={handleImportJson} className="btn-primary text-sm">Import Menu</button>
              {categories.length > 0 && (
                <p className="text-sm text-success-600">✓ Imported {categories.length} categories, {categories.reduce((s, c) => s + c.items.length, 0)} items</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((cat, ci) => (
                <div key={ci} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input className="input-field flex-1 bg-white" placeholder="Category name (e.g. Starters)" value={cat.name}
                      onChange={(e) => { const u = [...categories]; u[ci].name = e.target.value; setCategories(u); }} />
                    <button onClick={() => removeCategory(ci)} className="p-2 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {cat.items.map((item, ii) => (
                    <div key={ii} className="grid grid-cols-[1fr_80px_auto] gap-2 items-start">
                      <div>
                        <input className="input-field text-sm bg-white" placeholder="Item name" value={item.name}
                          onChange={(e) => { const u = [...categories]; u[ci].items[ii].name = e.target.value; setCategories(u); }} />
                      </div>
                      <div>
                        <input className="input-field text-sm bg-white" type="number" placeholder="Price" value={item.price || ""}
                          onChange={(e) => { const u = [...categories]; u[ci].items[ii].price = parseInt(e.target.value) || 0; setCategories(u); }} />
                        <span className="text-[10px] text-gray-400">pence</span>
                      </div>
                      <button onClick={() => { const u = [...categories]; u[ci].items = u[ci].items.filter((_, j) => j !== ii); setCategories(u); }}
                        className="p-2 text-gray-300 hover:text-red-500 mt-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => addItem(ci)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Add item</button>
                </div>
              ))}
              <button onClick={addCategory} className="btn-secondary text-sm w-full flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> Add Category
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Items: {categories.reduce((s, c) => s + c.items.filter((i) => i.name).length, 0)}/3 minimum
          </p>
        </div>
      )}

      {/* Step 3: Delivery & Hours */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Delivery & Hours</h2>
            <p className="text-sm text-gray-500 mt-1">Configure how customers get their food.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={delivery.delivery_enabled} onChange={(e) => setDelivery({ ...delivery, delivery_enabled: e.target.checked })} className="h-4 w-4 rounded text-brand-600" />
              <div><span className="text-sm font-medium">Delivery</span><p className="text-xs text-gray-400">You deliver to customers</p></div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={delivery.collection_enabled} onChange={(e) => setDelivery({ ...delivery, collection_enabled: e.target.checked })} className="h-4 w-4 rounded text-brand-600" />
              <div><span className="text-sm font-medium">Collection</span><p className="text-xs text-gray-400">Customers pick up</p></div>
            </label>
          </div>

          {delivery.delivery_enabled && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Delivery Fee (pence)</label>
                <input className="input-field" type="number" value={delivery.delivery_fee} onChange={(e) => setDelivery({ ...delivery, delivery_fee: parseInt(e.target.value) || 0 })} />
                <span className="text-xs text-gray-400">{formatPrice(delivery.delivery_fee)}</span>
              </div>
              <div>
                <label className="label">Min Order (pence)</label>
                <input className="input-field" type="number" value={delivery.min_order} onChange={(e) => setDelivery({ ...delivery, min_order: parseInt(e.target.value) || 0 })} />
                <span className="text-xs text-gray-400">{formatPrice(delivery.min_order)}</span>
              </div>
              <div>
                <label className="label">Delivery Radius (miles)</label>
                <input className="input-field" type="number" value={delivery.delivery_radius} onChange={(e) => setDelivery({ ...delivery, delivery_radius: parseInt(e.target.value) || 3 })} />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Opening Hours</label>
              <button onClick={() => {
                const mon = hours.Monday;
                setHours(Object.fromEntries(DAYS.map((d) => [d, { ...mon }])));
              }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Copy Monday to all</button>
            </div>
            <div className="space-y-2">
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-3 text-sm">
                  <span className="w-20 text-gray-600 shrink-0">{day.slice(0, 3)}</span>
                  <label className="flex items-center gap-1.5 shrink-0">
                    <input type="checkbox" checked={!hours[day].closed} onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], closed: !e.target.checked } })} className="h-3.5 w-3.5 rounded text-brand-600" />
                    <span className="text-xs text-gray-400">Open</span>
                  </label>
                  {!hours[day].closed && (
                    <>
                      <input type="time" className="input-field text-sm py-1 w-28" value={hours[day].open} onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], open: e.target.value } })} />
                      <span className="text-gray-300">—</span>
                      <input type="time" className="input-field text-sm py-1 w-28" value={hours[day].close} onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], close: e.target.value } })} />
                    </>
                  )}
                  {hours[day].closed && <span className="text-xs text-gray-400">Closed</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Payments */}
      {step === 3 && (
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Payment Setup</h2>
            <p className="text-sm text-gray-500 mt-1">Connect Stripe so customers can pay by card.</p>
          </div>

          {stripeConnected ? (
            <div className="bg-success-50 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-500 mx-auto mb-3" />
              <p className="font-semibold text-success-700">Stripe Connected</p>
              <p className="text-sm text-success-600 mt-1">You're ready to accept payments.</p>
            </div>
          ) : (
            <div className="text-center py-6">
              <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">Connect your Stripe account to start receiving payments directly to your bank account.</p>
              <a href="/api/stripe/connect" className="btn-primary inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Connect Stripe
              </a>
              <button onClick={() => saveStep(4)} className="block mx-auto mt-4 text-sm text-gray-400 hover:text-gray-600">
                Skip for now (you can connect later)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Go Live */}
      {step === 4 && !published && (
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Go Live Checklist</h2>
            <p className="text-sm text-gray-500 mt-1">Make sure everything's ready before publishing.</p>
          </div>

          <div className="space-y-3">
            {[
              { key: "profile", label: "Restaurant profile complete", required: true },
              { key: "menu", label: "3+ menu items added", required: true },
              { key: "hours", label: "Opening hours set", required: true },
              { key: "stripe", label: "Stripe payments connected", required: true },
              { key: "printer", label: "Printer connected", required: false },
            ].map((item) => {
              const done = checks[item.key as keyof typeof checks];
              return (
                <div key={item.key} className={cn("flex items-center gap-3 p-3 rounded-lg border", done ? "bg-success-50 border-success-200" : "bg-gray-50 border-gray-200")}>
                  {done ? <CheckCircle2 className="h-5 w-5 text-success-500" /> : <div className="h-5 w-5 rounded-full border-2 border-gray-300" />}
                  <span className={cn("text-sm font-medium", done ? "text-success-700" : "text-gray-600")}>{item.label}</span>
                  {!item.required && <span className="text-xs text-gray-400 ml-auto">Optional</span>}
                </div>
              );
            })}
          </div>

          <button onClick={goLive} disabled={saving || !checks.profile || !checks.menu || !checks.hours}
            className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
            Publish Your Restaurant
          </button>
          {(!checks.profile || !checks.menu || !checks.hours) && (
            <p className="text-xs text-center text-gray-400">Complete the required steps above to publish.</p>
          )}
        </div>
      )}

      {/* Published! */}
      {published && (
        <div className="card p-8 text-center space-y-5">
          <PartyPopper className="h-16 w-16 text-yellow-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold">You're Live! 🎉</h2>
            <p className="text-gray-500 mt-2">Your restaurant is now accepting orders.</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-2">
            <code className="text-sm font-mono flex-1 truncate select-all">{orderUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(orderUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="btn-secondary text-sm shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-3">
            <a href={orderUrl} target="_blank" rel="noopener" className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4" /> View Ordering Page
            </a>
            <button onClick={() => router.push("/dashboard")} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => router.push("/dashboard/printer")} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <Printer className="h-4 w-4" /> Set up printer
            </button>
            <button onClick={() => router.push("/dashboard/qr-code")} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              QR code & marketing →
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {step < 4 && !published && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="text-xs text-gray-400">Step {step + 1} of 5</span>
          <button onClick={() => saveStep(step + 1)} disabled={saving}
            className="btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{step === 3 ? "Continue" : "Next"} <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}
    </div>
  );
}
