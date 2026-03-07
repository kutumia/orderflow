"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail, Send, Plus, Loader2, Pencil, Trash2, Users,
  CheckCircle2, Clock, AlertTriangle, MessageSquare,
  BarChart3,
} from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";

const TEMPLATES = [
  { id: "special_offer", label: "Special Offer", body: "We have an exclusive offer just for you! Order this week and get 20% off your order." },
  { id: "new_menu", label: "New Menu Item", body: "We've just added something new to our menu that we think you'll love. Come check it out!" },
  { id: "we_miss_you", label: "We Miss You", body: "It's been a while since your last order. We'd love to see you again — here's a special treat to welcome you back." },
  { id: "custom", label: "Custom", body: "" },
];

const STATUS_STYLES: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "text-gray-500 bg-gray-100", icon: Clock },
  sending: { label: "Sending", color: "text-yellow-600 bg-yellow-50", icon: Loader2 },
  sent: { label: "Sent", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-600 bg-red-50", icon: AlertTriangle },
};

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [sending, setSending] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("custom");
  const [filter, setFilter] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/marketing");
    if (res.ok) setCampaigns(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const resetForm = () => {
    setName(""); setChannel("email"); setSubject(""); setBody("");
    setTemplate("custom"); setFilter({}); setEditing(null);
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };

  const openEdit = (c: any) => {
    setName(c.name); setChannel(c.channel); setSubject(c.subject || "");
    setBody(c.body); setTemplate(c.template || "custom");
    setFilter(c.audience_filter || {}); setEditing(c); setShowCreate(true);
  };

  const selectTemplate = (tpl: string) => {
    setTemplate(tpl);
    const t = TEMPLATES.find((t) => t.id === tpl);
    if (t && t.body) setBody(t.body);
  };

  const saveCampaign = async () => {
    setSaving(true);
    const payload = { name, channel, subject, body, template, audience_filter: filter };

    if (editing) {
      await fetch("/api/marketing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
    } else {
      await fetch("/api/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    setShowCreate(false);
    resetForm();
    fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    await fetch(`/api/marketing?id=${id}`, { method: "DELETE" });
    fetchCampaigns();
  };

  const sendCampaign = async (id: string) => {
    if (!confirm("Send this campaign to your customers now? This cannot be undone.")) return;
    setSending(id);
    await fetch("/api/marketing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: id }),
    });
    setSending(null);
    fetchCampaigns();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Marketing</h1>
          <p className="text-gray-500 text-sm mt-1">Email and SMS campaigns to your customers.</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>
      ) : campaigns.length === 0 ? (
        <div className="card p-12 text-center">
          <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-4">No campaigns yet. Reach out to your customers!</p>
          <button onClick={openCreate} className="btn-primary text-sm">Create First Campaign</button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const st = STATUS_STYLES[c.status] || STATUS_STYLES.draft;
            const Icon = st.icon;
            const stats = c.stats || {};
            return (
              <div key={c.id} className="card p-4 flex items-center gap-4">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center",
                  c.channel === "sms" ? "bg-green-50" : "bg-blue-50"
                )}>
                  {c.channel === "sms" ? <MessageSquare className="h-5 w-5 text-green-600" /> : <Mail className="h-5 w-5 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate">{c.name}</span>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1", st.color)}>
                      <Icon className={cn("h-3 w-3", c.status === "sending" && "animate-spin")} /> {st.label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.subject && <span className="mr-3">{c.subject}</span>}
                    {c.sent_at && <span>Sent {formatDateTime(c.sent_at)}</span>}
                    {stats.sent > 0 && <span className="ml-3">{stats.sent} delivered</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.status === "draft" && (
                    <>
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => sendCampaign(c.id)} disabled={sending === c.id}
                        className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                        {sending === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Send
                      </button>
                    </>
                  )}
                  <button onClick={() => deleteCampaign(c.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">{editing ? "Edit Campaign" : "New Campaign"}</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Campaign Name</label>
                <input className="input-field" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer Special" />
              </div>

              <div>
                <label className="label">Channel</label>
                <div className="flex gap-2">
                  <button onClick={() => setChannel("email")}
                    className={cn("flex-1 p-2 rounded-lg border text-sm font-medium",
                      channel === "email" ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-500"
                    )}>
                    <Mail className="h-4 w-4 mx-auto mb-1" /> Email
                  </button>
                  <button onClick={() => setChannel("sms")}
                    className={cn("flex-1 p-2 rounded-lg border text-sm font-medium",
                      channel === "sms" ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500"
                    )}>
                    <MessageSquare className="h-4 w-4 mx-auto mb-1" /> SMS
                  </button>
                </div>
              </div>

              {channel === "email" && (
                <>
                  <div>
                    <label className="label">Template</label>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATES.map((t) => (
                        <button key={t.id} onClick={() => selectTemplate(t.id)}
                          className={cn("text-xs px-3 py-1.5 rounded-full border",
                            template === t.id ? "bg-brand-50 border-brand-300 text-brand-700" : "border-gray-200 text-gray-500"
                          )}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Subject Line</label>
                    <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Something special just for you!" />
                  </div>
                </>
              )}

              <div>
                <label className="label">Message {channel === "sms" && <span className="text-gray-400 font-normal">({body.length}/160)</span>}</label>
                <textarea className="input-field min-h-[100px]" value={body}
                  onChange={(e) => setBody(channel === "sms" ? e.target.value.substring(0, 160) : e.target.value)}
                  placeholder="Write your message..." />
              </div>

              {/* Audience filter */}
              <div>
                <label className="label flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Audience Filter (optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Min orders</label>
                    <input type="number" className="input-field text-sm" placeholder="Any"
                      value={filter.min_orders || ""}
                      onChange={(e) => setFilter({ ...filter, min_orders: parseInt(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Last order before</label>
                    <input type="date" className="input-field text-sm"
                      value={filter.last_order_before || ""}
                      onChange={(e) => setFilter({ ...filter, last_order_before: e.target.value || undefined })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveCampaign} disabled={saving || !name || !body}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {editing ? "Update" : "Save Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
