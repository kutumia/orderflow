"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Gift, Loader2, Star, Award, Users, TrendingUp,
  CheckCircle2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";

function StampCard({ earned, required }: { earned: number; required: number }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {Array.from({ length: required }).map((_, i) => (
        <div key={i} className={cn(
          "h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all",
          i < earned
            ? "bg-brand-600 border-brand-600 text-white"
            : "bg-white border-gray-200 text-gray-300"
        )}>
          <Star className="h-5 w-5" fill={i < earned ? "currentColor" : "none"} />
        </div>
      ))}
    </div>
  );
}

export default function LoyaltyPage() {
  const [program, setProgram] = useState<any>(null);
  const [stats, setStats] = useState<any>({ totalCards: 0, activeCards: 0, totalRedeemed: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [type, setType] = useState("stamps");
  const [stampsRequired, setStampsRequired] = useState(8);
  const [pointsPerPound, setPointsPerPound] = useState(1);
  const [pointsToRedeem, setPointsToRedeem] = useState(100);
  const [rewardType, setRewardType] = useState("discount");
  const [rewardValue, setRewardValue] = useState(500);
  const [rewardItemName, setRewardItemName] = useState("");
  const [isActive, setIsActive] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/loyalty");
    if (res.ok) {
      const data = await res.json();
      setStats(data.stats);
      if (data.program) {
        const p = data.program;
        setProgram(p);
        setType(p.type);
        setStampsRequired(p.stamps_required);
        setPointsPerPound(p.points_per_pound);
        setPointsToRedeem(p.points_to_redeem);
        setRewardType(p.reward_type);
        setRewardValue(p.reward_value);
        setRewardItemName(p.reward_item_name || "");
        setIsActive(p.is_active);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async () => {
    setSaving(true);
    await fetch("/api/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type, stamps_required: stampsRequired, points_per_pound: pointsPerPound,
        points_to_redeem: pointsToRedeem, reward_type: rewardType,
        reward_value: rewardValue, reward_item_name: rewardItemName || null,
        is_active: isActive,
      }),
    });
    setSaving(false);
    fetchData();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Loyalty Program</h1>
          <p className="text-gray-500 text-sm mt-1">Reward repeat customers to increase order frequency.</p>
        </div>
        <button onClick={() => { setIsActive(!isActive); }} className="flex items-center gap-2 text-sm">
          {isActive ? (
            <><ToggleRight className="h-6 w-6 text-success-500" /> Active</>
          ) : (
            <><ToggleLeft className="h-6 w-6 text-gray-300" /> Inactive</>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <Users className="h-5 w-5 text-gray-300 mx-auto mb-1" />
          <div className="text-xl font-bold">{stats.totalCards}</div>
          <div className="text-xs text-gray-500">Cards Issued</div>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp className="h-5 w-5 text-gray-300 mx-auto mb-1" />
          <div className="text-xl font-bold">{stats.activeCards}</div>
          <div className="text-xs text-gray-500">Active (30 days)</div>
        </div>
        <div className="card p-4 text-center">
          <Award className="h-5 w-5 text-gray-300 mx-auto mb-1" />
          <div className="text-xl font-bold">{stats.totalRedeemed}</div>
          <div className="text-xs text-gray-500">Rewards Redeemed</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold">Program Type</h3>
          <div className="flex gap-2">
            <button onClick={() => setType("stamps")}
              className={cn("flex-1 p-3 rounded-lg border text-sm font-medium transition-colors",
                type === "stamps" ? "bg-brand-50 border-brand-300 text-brand-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
              )}>
              <Star className="h-5 w-5 mx-auto mb-1" />
              Stamp Card
            </button>
            <button onClick={() => setType("points")}
              className={cn("flex-1 p-3 rounded-lg border text-sm font-medium transition-colors",
                type === "points" ? "bg-brand-50 border-brand-300 text-brand-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
              )}>
              <Gift className="h-5 w-5 mx-auto mb-1" />
              Points
            </button>
          </div>

          {type === "stamps" ? (
            <div>
              <label className="label">Stamps Required for Reward</label>
              <input type="number" min={2} max={20} value={stampsRequired}
                onChange={(e) => setStampsRequired(parseInt(e.target.value) || 8)}
                className="input-field" />
              <p className="text-xs text-gray-400 mt-1">Customer earns 1 stamp per order</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Points per £1 spent</label>
                <input type="number" min={1} max={10} value={pointsPerPound}
                  onChange={(e) => setPointsPerPound(parseInt(e.target.value) || 1)}
                  className="input-field" />
              </div>
              <div>
                <label className="label">Points to Redeem Reward</label>
                <input type="number" min={10} max={1000} value={pointsToRedeem}
                  onChange={(e) => setPointsToRedeem(parseInt(e.target.value) || 100)}
                  className="input-field" />
              </div>
            </div>
          )}

          <div>
            <label className="label">Reward Type</label>
            <select value={rewardType} onChange={(e) => setRewardType(e.target.value)} className="input-field">
              <option value="discount">Discount (£ off)</option>
              <option value="free_delivery">Free Delivery</option>
              <option value="free_item">Free Item</option>
            </select>
          </div>

          {rewardType === "discount" && (
            <div>
              <label className="label">Discount Amount (pence)</label>
              <input type="number" min={100} value={rewardValue}
                onChange={(e) => setRewardValue(parseInt(e.target.value) || 500)}
                className="input-field" />
              <p className="text-xs text-gray-400 mt-1">{formatPrice(rewardValue)} off</p>
            </div>
          )}

          {rewardType === "free_item" && (
            <div>
              <label className="label">Free Item Name</label>
              <input type="text" value={rewardItemName}
                onChange={(e) => setRewardItemName(e.target.value)}
                placeholder="e.g. Regular Drink" className="input-field" />
            </div>
          )}

          <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Program
          </button>
        </div>

        {/* Preview */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Customer Preview</h3>
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            {type === "stamps" ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  {5} of {stampsRequired} stamps earned — {stampsRequired - 5} more for your reward!
                </p>
                <StampCard earned={5} required={stampsRequired} />
                <p className="text-xs text-gray-400 mt-4">
                  Reward: {rewardType === "discount" ? `${formatPrice(rewardValue)} off` :
                    rewardType === "free_delivery" ? "Free delivery" :
                    `Free ${rewardItemName || "item"}`}
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl font-bold text-brand-600 mb-2">75</div>
                <p className="text-sm text-gray-600 mb-1">points earned</p>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-3 mb-2">
                  <div className="h-full bg-brand-600 rounded-full" style={{ width: `${(75 / pointsToRedeem) * 100}%` }} />
                </div>
                <p className="text-xs text-gray-400">
                  {pointsToRedeem - 75} more points for your reward
                  ({rewardType === "discount" ? formatPrice(rewardValue) + " off" :
                    rewardType === "free_delivery" ? "Free delivery" :
                    `Free ${rewardItemName || "item"}`})
                </p>
              </>
            )}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              Customers see their loyalty progress when they enter their email at checkout.
              Stamps/points are earned automatically when an order is confirmed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
