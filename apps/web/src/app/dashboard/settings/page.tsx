"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Settings, ExternalLink, Copy, Check, Loader2, Save, Upload,
  MapPin, Phone, Mail, FileText, Truck, Store, Clock,
  Sun, AlertTriangle, QrCode, Image as ImageIcon, X,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 mb-6">
      <h3 className="font-semibold mb-1">{title}</h3>
      {desc && <p className="text-sm text-gray-400 mb-4">{desc}</p>}
      {children}
    </div>
  );
}

function PenceInput({ label, value, onChange, placeholder }: {
  label: string; value: number; onChange: (v: number) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
        <input
          type="number"
          step="0.01"
          min="0"
          className="input-field pl-7"
          placeholder={placeholder}
          value={(value / 100).toFixed(2)}
          onChange={(e) => onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    description: "",
    logo_url: "",
    banner_url: "",
    delivery_enabled: true,
    collection_enabled: true,
    delivery_fee: 250,
    min_order_delivery: 1000,
    min_order_collection: 0,
    estimated_delivery_mins: 45,
    estimated_collection_mins: 20,
    holiday_mode: false,
    holiday_message: "",
    vat_registered: false,
    vat_number: "",
  });

  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/restaurant-settings")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          description: data.description || "",
          logo_url: data.logo_url || "",
          banner_url: data.banner_url || "",
          delivery_enabled: data.delivery_enabled ?? true,
          collection_enabled: data.collection_enabled ?? true,
          delivery_fee: data.delivery_fee ?? 250,
          min_order_delivery: data.min_order_delivery ?? 1000,
          min_order_collection: data.min_order_collection ?? 0,
          estimated_delivery_mins: data.estimated_delivery_mins ?? 45,
          estimated_collection_mins: data.estimated_collection_mins ?? 20,
          holiday_mode: data.holiday_mode ?? false,
          holiday_message: data.holiday_message || "",
          vat_registered: data.vat_registered ?? false,
          vat_number: data.vat_number || "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleImageUpload = async (type: "logo" | "banner", file: File) => {
    setUploading(type);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("restaurant_id", user?.restaurant_id || "");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        set(type === "logo" ? "logo_url" : "banner_url", data.url);
      }
    } catch {}
    setUploading(null);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/restaurant-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  };

  const orderingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${user?.restaurant_slug}`
    : "";

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(orderingUrl)}`;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Restaurant profile and configuration.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
          ) : saved ? (
            <><Check className="h-4 w-4" />Saved!</>
          ) : (
            <><Save className="h-4 w-4" />Save Changes</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger-500 text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />{error}
        </div>
      )}

      {/* Ordering Link & QR */}
      <Section title="Ordering Link" desc="Share this with customers to receive orders.">
        <div className="flex items-center gap-3 mb-4">
          <code className="bg-gray-100 px-4 py-2.5 rounded-lg text-sm flex-1 text-brand-700 truncate">
            {orderingUrl}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(orderingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="btn-secondary flex items-center gap-2 text-sm shrink-0"
          >
            {copied ? <Check className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <a href={`/${user?.restaurant_slug}`} target="_blank" rel="noopener" className="btn-secondary flex items-center gap-2 text-sm shrink-0">
            <ExternalLink className="h-4 w-4" /> Preview
          </a>
        </div>
        <div className="flex items-start gap-4">
          <div className="bg-white border rounded-lg p-2 shrink-0">
            <img src={qrUrl} alt="QR Code" className="h-32 w-32" />
          </div>
          <div className="text-sm text-gray-500">
            <p className="flex items-center gap-1 mb-2"><QrCode className="h-4 w-4" /> <strong>QR Code</strong></p>
            <p>Print this QR code on flyers, table cards, or your window. Customers scan it to order directly from their phone.</p>
            <a href={qrUrl} download="orderflow-qr-code.png" className="text-brand-600 text-xs mt-2 inline-block hover:underline">
              Download QR code (PNG)
            </a>
          </div>
        </div>
      </Section>

      {/* Embed Widget */}
      <Section title="Embed on Your Website" desc="Add ordering to any website with a single line of code.">
        <div className="space-y-3">
          <div>
            <label className="label">Embed Code</label>
            <div className="relative">
              <code className="block bg-gray-50 border rounded-lg p-3 text-xs font-mono text-gray-700 select-all break-all">
                {`<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://orderflow.co.uk'}/widget.js" data-restaurant="${user?.restaurant_slug || 'your-slug'}"></script>`}
              </code>
              <button
                onClick={() => {
                  const code = `<script src="${window.location.origin}/widget.js" data-restaurant="${user?.restaurant_slug}"></script>`;
                  navigator.clipboard.writeText(code);
                }}
                className="absolute top-2 right-2 text-xs text-brand-600 hover:text-brand-700 bg-white px-2 py-1 rounded border"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Paste this in your website's HTML, just before <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code>. A floating "Order Online" button will appear.
            </p>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p><strong>Options:</strong></p>
            <p><code className="bg-gray-100 px-1 rounded">data-button-text="Order Now"</code> — Change button text</p>
            <p><code className="bg-gray-100 px-1 rounded">data-position="bottom-left"</code> — Move to bottom-left</p>
            <p><code className="bg-gray-100 px-1 rounded">data-colour="#FF5500"</code> — Custom brand colour</p>
          </div>
        </div>
      </Section>

      {/* Custom Domain */}
      <Section title="Custom Domain" desc="Use your own domain for the ordering page (optional).">
        <div className="space-y-3">
          <div>
            <label className="label">Custom Domain</label>
            <input className="input-field" placeholder="order.yourrestaurant.co.uk"
              value={form.custom_domain || ""} onChange={(e) => set("custom_domain", e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Point a CNAME record to <code className="bg-gray-100 px-1 rounded">cname.orderflow.co.uk</code> then enter the domain here.
            </p>
          </div>
        </div>
      </Section>

      {/* Restaurant Profile */}
      <Section title="Restaurant Profile" desc="Basic information shown to customers.">
        <div className="space-y-4">
          <div>
            <label className="label">Restaurant Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input-field" rows={3} placeholder="Tell customers about your restaurant..."
              value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1"><MapPin className="h-3 w-3" />Address</label>
              <input className="input-field" placeholder="123 High Street, London"
                value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Phone className="h-3 w-3" />Phone</label>
              <input className="input-field" type="tel" placeholder="020 1234 5678"
                value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1"><Mail className="h-3 w-3" />Contact Email</label>
            <input className="input-field" type="email" placeholder="hello@restaurant.co.uk"
              value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Logo & Banner */}
      <Section title="Branding" desc="Logo and banner image for your ordering page.">
        <div className="grid grid-cols-2 gap-6">
          {/* Logo */}
          <div>
            <label className="label">Logo</label>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload("logo", e.target.files[0])} />
            {form.logo_url ? (
              <div className="relative group">
                <img src={form.logo_url} alt="Logo" className="h-24 w-24 rounded-lg object-cover border" />
                <button
                  onClick={() => set("logo_url", "")}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploading === "logo"}
                className="h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors"
              >
                {uploading === "logo" ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <><Upload className="h-5 w-5 mb-1" /><span className="text-xs">Upload</span></>
                )}
              </button>
            )}
          </div>
          {/* Banner */}
          <div>
            <label className="label">Banner Image</label>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload("banner", e.target.files[0])} />
            {form.banner_url ? (
              <div className="relative group">
                <img src={form.banner_url} alt="Banner" className="h-24 w-full rounded-lg object-cover border" />
                <button
                  onClick={() => set("banner_url", "")}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploading === "banner"}
                className="h-24 w-full rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors"
              >
                {uploading === "banner" ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <><ImageIcon className="h-5 w-5 mb-1" /><span className="text-xs">Upload banner</span></>
                )}
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* Delivery & Collection */}
      <Section title="Delivery & Collection" desc="Configure order types, fees, and estimated times.">
        <div className="space-y-5">
          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600"
                checked={form.delivery_enabled} onChange={(e) => set("delivery_enabled", e.target.checked)} />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Truck className="h-4 w-4 text-gray-400" /> Delivery
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600"
                checked={form.collection_enabled} onChange={(e) => set("collection_enabled", e.target.checked)} />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Store className="h-4 w-4 text-gray-400" /> Collection
              </span>
            </label>
          </div>

          {!form.delivery_enabled && !form.collection_enabled && (
            <div className="bg-warning-50 text-warning-500 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              At least one order type must be enabled.
            </div>
          )}

          {/* Delivery settings */}
          {form.delivery_enabled && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-1.5"><Truck className="h-4 w-4" /> Delivery Settings</h4>
              <div className="grid grid-cols-3 gap-4">
                <PenceInput label="Delivery Fee" value={form.delivery_fee}
                  onChange={(v) => set("delivery_fee", v)} placeholder="2.50" />
                <PenceInput label="Minimum Order" value={form.min_order_delivery}
                  onChange={(v) => set("min_order_delivery", v)} placeholder="10.00" />
                <div>
                  <label className="label flex items-center gap-1"><Clock className="h-3 w-3" />Est. Time (mins)</label>
                  <input type="number" min="1" className="input-field"
                    value={form.estimated_delivery_mins}
                    onChange={(e) => set("estimated_delivery_mins", parseInt(e.target.value) || 45)} />
                </div>
              </div>
            </div>
          )}

          {/* Collection settings */}
          {form.collection_enabled && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-1.5"><Store className="h-4 w-4" /> Collection Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <PenceInput label="Minimum Order" value={form.min_order_collection}
                  onChange={(v) => set("min_order_collection", v)} placeholder="0.00" />
                <div>
                  <label className="label flex items-center gap-1"><Clock className="h-3 w-3" />Est. Time (mins)</label>
                  <input type="number" min="1" className="input-field"
                    value={form.estimated_collection_mins}
                    onChange={(e) => set("estimated_collection_mins", parseInt(e.target.value) || 20)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Holiday Mode */}
      <Section title="Holiday Mode" desc="Temporarily pause all orders.">
        <label className="flex items-center gap-3 cursor-pointer mb-3">
          <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600"
            checked={form.holiday_mode} onChange={(e) => set("holiday_mode", e.target.checked)} />
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Sun className="h-4 w-4 text-yellow-500" /> Enable Holiday Mode
          </span>
        </label>
        {form.holiday_mode && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <label className="label">Holiday Message (shown to customers)</label>
            <input className="input-field"
              placeholder="We're on holiday! Back on Monday."
              value={form.holiday_message}
              onChange={(e) => set("holiday_message", e.target.value)} />
            <p className="text-xs text-yellow-600 mt-2">
              While holiday mode is on, customers will see this message and cannot place orders.
            </p>
          </div>
        )}
      </Section>

      {/* VAT */}
      <Section title="VAT Settings" desc="UK VAT registration details.">
        <label className="flex items-center gap-3 cursor-pointer mb-3">
          <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600"
            checked={form.vat_registered} onChange={(e) => set("vat_registered", e.target.checked)} />
          <span className="text-sm font-medium">VAT Registered</span>
        </label>
        {form.vat_registered && (
          <div>
            <label className="label">VAT Number</label>
            <input className="input-field" placeholder="GB 123456789"
              value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)} />
          </div>
        )}
      </Section>

      {/* Save button (bottom) */}
      <div className="flex justify-end mb-12">
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
