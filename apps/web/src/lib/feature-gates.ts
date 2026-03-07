/**
 * Feature Gating — controls which features are available per plan.
 *
 * Plans: starter (£49) → growth (£89) → pro (£149)
 * Each higher tier includes all lower-tier features.
 */

export type Plan = "starter" | "growth" | "pro";

export type Feature =
  | "ordering"           // All plans
  | "dashboard"          // All plans
  | "printer"            // All plans (1 device on starter)
  | "promo_codes"        // All plans
  | "reports_basic"      // All plans
  | "loyalty"            // Growth+
  | "marketing"          // Growth+
  | "advanced_reports"   // Growth+
  | "csv_export"         // Growth+
  | "multi_printer"      // Growth+
  | "custom_domain"      // Pro only
  | "multi_location"     // Pro only
  | "api_access"         // Pro only
  | "priority_support"   // Pro only
  | "white_label";       // Pro only

const PLAN_FEATURES: Record<Plan, Feature[]> = {
  starter: [
    "ordering",
    "dashboard",
    "printer",
    "promo_codes",
    "reports_basic",
  ],
  growth: [
    "ordering",
    "dashboard",
    "printer",
    "promo_codes",
    "reports_basic",
    "loyalty",
    "marketing",
    "advanced_reports",
    "csv_export",
    "multi_printer",
  ],
  pro: [
    "ordering",
    "dashboard",
    "printer",
    "promo_codes",
    "reports_basic",
    "loyalty",
    "marketing",
    "advanced_reports",
    "csv_export",
    "multi_printer",
    "custom_domain",
    "multi_location",
    "api_access",
    "priority_support",
    "white_label",
  ],
};

/**
 * Check if a plan has access to a feature.
 */
export function hasFeature(plan: Plan | string | undefined, feature: Feature): boolean {
  const p = (plan || "starter") as Plan;
  return PLAN_FEATURES[p]?.includes(feature) ?? false;
}

/**
 * Get the minimum plan required for a feature.
 */
export function requiredPlan(feature: Feature): Plan {
  if (PLAN_FEATURES.starter.includes(feature)) return "starter";
  if (PLAN_FEATURES.growth.includes(feature)) return "growth";
  return "pro";
}

/**
 * Map dashboard paths to required features.
 * If a path is not listed, it's available to all plans.
 */
export const GATED_PATHS: Record<string, Feature> = {
  "/dashboard/loyalty": "loyalty",
  "/dashboard/marketing": "marketing",
  "/dashboard/qr-code": "marketing",
};

/**
 * Get all features for a plan.
 */
export function planFeatures(plan: Plan | string): Feature[] {
  return PLAN_FEATURES[(plan || "starter") as Plan] || PLAN_FEATURES.starter;
}

/**
 * Plan display info.
 */
export const PLANS = {
  starter: {
    name: "Starter",
    price: 4900,         // £49/month
    annualPrice: 40800,  // £408/year (£34/month — 2 months free)
    description: "Everything you need to start taking direct orders.",
    features: [
      "Online ordering & checkout",
      "Restaurant dashboard",
      "1 printer device",
      "Promo codes & discounts",
      "Basic reports",
      "Email support",
    ],
  },
  growth: {
    name: "Growth",
    price: 8900,         // £89/month
    annualPrice: 74200,  // £742/year (£61.83/month)
    description: "Grow repeat business with loyalty and marketing tools.",
    features: [
      "Everything in Starter",
      "Loyalty stamps & points",
      "Email & SMS campaigns",
      "Advanced reports & CSV export",
      "Multiple printer devices",
      "Priority email support",
    ],
  },
  pro: {
    name: "Pro",
    price: 14900,        // £149/month
    annualPrice: 124200, // £1,242/year (£103.50/month)
    description: "For growing restaurants and multi-location operators.",
    features: [
      "Everything in Growth",
      "Custom domain",
      "Multi-location support",
      "API access",
      "White-label ordering",
      "Priority phone support",
    ],
  },
} as const;

export const SETUP_FEE = 14900; // £149 one-time
