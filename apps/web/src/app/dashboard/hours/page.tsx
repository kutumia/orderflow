"use client";
import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Hours { id: string; day_of_week: number; open_time: string; close_time: string; is_closed: boolean; }

export default function HoursPage() {
  const [hours, setHours] = useState<Hours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/hours").then(r => r.json()).then(data => { setHours(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const update = (day: number, field: string, value: any) => {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    setSaving(false);
    setSaved(true);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Opening Hours</h1>
          <p className="text-gray-500 text-sm mt-1">Set when customers can place orders.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>
      <div className="card divide-y">
        {DAYS.map((name, i) => {
          const h = hours.find(x => x.day_of_week === i);
          if (!h) return null;
          return (
            <div key={i} className="flex items-center gap-4 p-4">
              <span className="w-28 text-sm font-medium">{name}</span>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!h.is_closed} onChange={e => update(i, "is_closed", !e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                <span className="text-sm text-gray-600">{h.is_closed ? "Closed" : "Open"}</span>
              </label>
              {!h.is_closed && (
                <>
                  <input type="time" value={h.open_time} onChange={e => update(i, "open_time", e.target.value)} className="input-field w-32 text-sm" />
                  <span className="text-gray-400 text-sm">to</span>
                  <input type="time" value={h.close_time} onChange={e => update(i, "close_time", e.target.value)} className="input-field w-32 text-sm" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
