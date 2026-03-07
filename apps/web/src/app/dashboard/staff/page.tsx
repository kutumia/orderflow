"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Users, Plus, Loader2, Trash2, Shield, ShieldCheck,
  Key, X, AlertTriangle, Copy, Check, Mail, UserCircle,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

const ROLE_CONFIG: Record<string, { label: string; desc: string; icon: any; color: string }> = {
  owner: {
    label: "Owner",
    desc: "Full access — settings, billing, staff, reports",
    icon: ShieldCheck,
    color: "text-brand-600 bg-brand-50",
  },
  staff: {
    label: "Staff",
    desc: "Orders, kitchen, menu only — no billing or settings",
    icon: Shield,
    color: "text-gray-600 bg-gray-100",
  },
};

const STAFF_PAGES = [
  "/dashboard", "/dashboard/orders", "/dashboard/kitchen",
  "/dashboard/menu", "/dashboard/hours", "/dashboard/printer",
];

function InviteModal({ onClose, onInvite }: {
  onClose: () => void;
  onInvite: (data: any) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", role: "staff" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleInvite = async () => {
    setSaving(true);
    setError("");
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data);
      onInvite(data);
    } else {
      setError(data.error || "Failed to invite");
    }
    setSaving(false);
  };

  const copyCredentials = () => {
    const text = `Email: ${result.email}\nPassword: ${result.temp_password}\nLogin: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-lg">{result ? "Staff Member Added" : "Invite Staff"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
        </div>

        {result ? (
          <div className="p-5">
            <div className="bg-success-50 text-success-500 rounded-lg p-4 mb-4 text-sm">
              <strong>{result.name}</strong> has been added. Share these login credentials with them:
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 font-mono text-sm">
              <div><span className="text-gray-400">Email:</span> {result.email}</div>
              <div><span className="text-gray-400">Password:</span> <strong>{result.temp_password}</strong></div>
              <div><span className="text-gray-400">Login:</span> {typeof window !== "undefined" ? `${window.location.origin}/login` : "/login"}</div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              They should change their password after first login.
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={copyCredentials} className="btn-secondary flex items-center gap-2 text-sm flex-1">
                {copied ? <Check className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy Credentials"}
              </button>
              <button onClick={onClose} className="btn-primary text-sm">Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input className="input-field" placeholder="e.g. Alex Kitchen"
                  value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input-field" type="email" placeholder="alex@example.com"
                  value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div>
                <label className="label">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(ROLE_CONFIG).map(([key, conf]) => {
                    const Icon = conf.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => set("role", key)}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-colors",
                          form.role === key
                            ? "border-brand-500 bg-brand-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{conf.label}</span>
                        </div>
                        <p className="text-xs text-gray-500">{conf.desc}</p>
                      </button>
                    );
                  })}
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
              <button onClick={handleInvite} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Inviting..." : "Send Invite"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function StaffPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [resetResult, setResetResult] = useState<{ id: string; password: string } | null>(null);

  const fetchStaff = useCallback(async () => {
    const res = await fetch("/api/staff");
    if (res.ok) setStaff(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const updateRole = async (id: string, role: string) => {
    await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    fetchStaff();
  };

  const resetPassword = async (id: string) => {
    if (!confirm("Generate a new temporary password for this user?")) return;
    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reset_password: true }),
    });
    const data = await res.json();
    if (res.ok && data.temp_password) {
      setResetResult({ id, password: data.temp_password });
    }
  };

  const removeStaff = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your team? They will lose all access.`)) return;
    await fetch(`/api/staff?id=${id}`, { method: "DELETE" });
    fetchStaff();
  };

  if (user?.role !== "owner") {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Staff</h1>
        <div className="card p-12 text-center">
          <Shield className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Only restaurant owners can manage staff accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-gray-500 text-sm mt-1">{staff.length} team member{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Invite Staff
        </button>
      </div>

      {/* Role permissions reference */}
      <div className="card p-4 mb-6">
        <h3 className="text-sm font-medium mb-3">Role Permissions</h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-medium text-brand-600">Owner</span>
            <p className="text-gray-500 mt-0.5">Everything: orders, menu, settings, billing, reports, staff, promotions, customers</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Staff</span>
            <p className="text-gray-500 mt-0.5">Orders, kitchen display, menu editing, opening hours, printer only</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="card divide-y">
          {staff.map((member) => {
            const isYou = member.id === user?.id;
            const roleConf = ROLE_CONFIG[member.role] || ROLE_CONFIG.staff;
            const RoleIcon = roleConf.icon;

            return (
              <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                <div className="h-10 w-10 bg-brand-50 rounded-full flex items-center justify-center shrink-0">
                  <UserCircle className="h-5 w-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{member.name}</span>
                    {isYou && <span className="text-xs text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">You</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</span>
                    {member.last_login_at && (
                      <span>Last login: {new Date(member.last_login_at).toLocaleDateString("en-GB")}</span>
                    )}
                  </div>

                  {/* Reset password result */}
                  {resetResult?.id === member.id && (
                    <div className="mt-2 bg-yellow-50 text-yellow-700 text-xs rounded px-3 py-2 flex items-center gap-2">
                      <Key className="h-3 w-3" />
                      New password: <strong className="font-mono">{resetResult.password}</strong>
                      <button
                        onClick={() => { navigator.clipboard.writeText(resetResult.password); }}
                        className="ml-1 underline"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>

                {/* Role badge */}
                <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0", roleConf.color)}>
                  <RoleIcon className="h-3 w-3" />
                  {roleConf.label}
                </span>

                {/* Actions (not for yourself) */}
                {!isYou && (
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={member.role}
                      onChange={(e) => updateRole(member.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="owner">Owner</option>
                      <option value="staff">Staff</option>
                    </select>
                    <button
                      onClick={() => resetPassword(member.id)}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                      title="Reset password"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeStaff(member.id, member.name)}
                      className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvite={(data) => setStaff((prev) => [...prev, data])}
        />
      )}
    </div>
  );
}
