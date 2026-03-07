"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  CreditCard, ExternalLink, CheckCircle2, AlertTriangle,
  Loader2, Shield, Sparkles, Crown, Zap, ArrowRight, Check,
} from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import { PLANS, SETUP_FEE, type Plan } from "@/lib/feature-gates";

type ConnectStatus = "loading" | "not_started" | "incomplete" | "complete";

function PlanCard({
  planKey,
  current,
  annual,
  onSelect,
  loading,
}: {
  planKey: Plan;
  current: boolean;
  annual: boolean;
  onSelect: (plan: Plan) => void;
  loading: boolean;
}) {
  const plan = PLANS[planKey];
  const price = annual ? plan.annualPrice : plan.price;
  const monthly = annual ? Math.round(plan.annualPrice / 12) : plan.price;
  const icons: Record<string, any> = { starter: Zap, growth: Sparkles, pro: Crown };
  const Icon = icons[planKey] || Zap;
  const isPopular = planKey === "growth";

  return (
    <div className={cn(
      "card p-5 relative flex flex-col",
      current && "ring-2 ring-brand-600",
      isPopular && !current && "ring-2 ring-orange-400"
    )}>
      {isPopular && !current && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-400 text-white text-[11px] font-bold px-3 py-0.5 rounded-full">
          Most Popular
        </div>
      )}
      {current && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full">
          Current Plan
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center",
          planKey === "starter" ? "bg-blue-50" : planKey === "growth" ? "bg-orange-50" : "bg-purple-50"
        )}>
          <Icon className={cn("h-4 w-4",
            planKey === "starter" ? "text-blue-600" : planKey === "growth" ? "text-orange-600" : "text-purple-600"
          )} />
        </div>
        <span className="font-semibold">{plan.name}</span>
      </div>

      <div className="mb-1">
        <span className="text-3xl font-bold">{formatPrice(monthly)}</span>
        <span className="text-sm text-gray-400">/month</span>
      </div>
      {annual && (
        <p className="text-xs text-success-600 mb-3">
          {formatPrice(price)}/year — save {formatPrice(PLANS[planKey].price * 12 - price)}
        </p>
      )}
      {!annual && <p className="text-xs text-gray-400 mb-3">Billed monthly</p>}

      <p className="text-sm text-gray-500 mb-4">{plan.description}</p>

      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-success-500 shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {current ? (
        <div className="text-center text-sm text-gray-400 py-2">Current plan</div>
      ) : (
        <button
          onClick={() => onSelect(planKey)}
          disabled={loading}
          className={cn(
            "w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors",
            isPopular
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "bg-brand-600 text-white hover:bg-brand-700"
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>
              {planKey > (current ? planKey : "starter") ? "Upgrade" : "Switch"} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function BillingPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const user = session?.user as any;

  const [connectStatus, setConnectStatus] = useState<ConnectStatus>("loading");
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [sub, setSub] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [annual, setAnnual] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  const currentPlan = (user?.plan || "starter") as Plan;
  const upgradeFeature = searchParams.get("feature");
  const upgradePlan = searchParams.get("plan");

  useEffect(() => {
    checkStatus();
    fetchSubscription();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/stripe/connect");
      if (res.ok) {
        const data = await res.json();
        setConnectStatus(data.charges_enabled ? "complete" : data.details_submitted ? "incomplete" : "not_started");
        if (data.dashboard_url) setDashboardUrl(data.dashboard_url);
      }
    } catch {}
    setConnectStatus((prev) => (prev === "loading" ? "not_started" : prev));
  };

  const fetchSubscription = async () => {
    try {
      const res = await fetch("/api/subscription");
      if (res.ok) setSub(await res.json());
    } catch {}
    setSubLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError("Failed to start Stripe setup");
    } catch { setError("Something went wrong"); }
    setConnecting(false);
  };

  const handlePlanChange = async (plan: Plan) => {
    if (plan === currentPlan) return;
    const direction = (["starter", "growth", "pro"].indexOf(plan) > ["starter", "growth", "pro"].indexOf(currentPlan))
      ? "upgrade" : "downgrade";

    if (direction === "downgrade" && !confirm(`Downgrade to ${PLANS[plan].name}? You'll lose access to some features at the end of your current billing period.`)) return;

    setChangingPlan(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, annual }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        if (data.checkout_url) window.location.href = data.checkout_url;
        else setError(data.error || "Plan change failed");
      }
    } catch { setError("Something went wrong"); }
    setChangingPlan(false);
  };

  const handleSetupFee = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup_fee" }),
      });
      const data = await res.json();
      if (data.checkout_url) window.location.href = data.checkout_url;
    } catch { setError("Something went wrong"); }
    setConnecting(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your subscription and payment settings.</p>
      </div>

      {/* Upgrade prompt */}
      {upgradeFeature && upgradePlan && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-orange-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              Upgrade to {PLANS[upgradePlan as Plan]?.name || "Growth"} to access{" "}
              {upgradeFeature.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-orange-600">
              Choose a plan below to unlock this feature.
            </p>
          </div>
        </div>
      )}

      {/* Annual toggle */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <span className={cn("text-sm font-medium", !annual ? "text-gray-900" : "text-gray-400")}>Monthly</span>
        <button onClick={() => setAnnual(!annual)}
          className={cn("relative w-12 h-6 rounded-full transition-colors",
            annual ? "bg-success-500" : "bg-gray-300"
          )}>
          <div className={cn("absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform",
            annual ? "translate-x-6" : "translate-x-0.5"
          )} />
        </button>
        <span className={cn("text-sm font-medium", annual ? "text-gray-900" : "text-gray-400")}>
          Annual <span className="text-success-600 text-xs font-normal">(2 months free)</span>
        </span>
      </div>

      {/* Pricing cards */}
      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {(["starter", "growth", "pro"] as Plan[]).map((p) => (
          <PlanCard
            key={p}
            planKey={p}
            current={p === currentPlan}
            annual={annual}
            onSelect={handlePlanChange}
            loading={changingPlan}
          />
        ))}
      </div>

      {/* Setup fee */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Professional Setup</h3>
              <p className="text-xs text-gray-400">
                We upload your menu, install your printer, and train your staff. One-time fee.
              </p>
            </div>
          </div>
          {user?.setup_fee_paid ? (
            <span className="flex items-center gap-1 text-sm text-success-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Paid
            </span>
          ) : (
            <button onClick={handleSetupFee} disabled={connecting}
              className="btn-primary text-sm flex items-center gap-2">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pay {formatPrice(SETUP_FEE)}
            </button>
          )}
        </div>
      </div>

      {/* Stripe Connect */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Payment Processing</h3>
            <p className="text-xs text-gray-400">Receive payments directly to your bank account via Stripe.</p>
          </div>
        </div>

        {connectStatus === "loading" ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        ) : connectStatus === "complete" ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-success-600">
              <CheckCircle2 className="h-4 w-4" /> Connected
            </span>
            {dashboardUrl && (
              <a href={dashboardUrl} target="_blank" rel="noopener" className="btn-secondary text-sm flex items-center gap-2">
                <ExternalLink className="h-4 w-4" /> Stripe Dashboard
              </a>
            )}
          </div>
        ) : (
          <button onClick={handleConnect} disabled={connecting} className="btn-primary text-sm flex items-center gap-2">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {connectStatus === "incomplete" ? "Complete Setup" : "Connect Stripe"}
          </button>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Subscription info */}
      {sub && (
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-3">Subscription Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Status:</span> <span className="capitalize">{sub.status}</span></div>
            <div><span className="text-gray-400">Plan:</span> <span className="capitalize">{currentPlan}</span></div>
            {sub.current_period_end && (
              <div><span className="text-gray-400">Next billing:</span> {new Date(sub.current_period_end * 1000).toLocaleDateString("en-GB")}</div>
            )}
            {sub.trial_end && (
              <div><span className="text-gray-400">Trial ends:</span> {new Date(sub.trial_end * 1000).toLocaleDateString("en-GB")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
