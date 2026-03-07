"use client";

import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com";

// Initialize PostHog (only once)
let initialized = false;

function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We handle this manually
    capture_pageleave: true,
    persistence: "memory", // No localStorage for privacy
  });
  initialized = true;
}

/**
 * PostHog page view tracker — add to root layout.
 */
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
    if (!POSTHOG_KEY) return;
    const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Track a custom event.
 */
export function trackEvent(event: string, properties?: Record<string, any>) {
  initPostHog();
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

/**
 * Identify a user (call after login).
 */
export function identifyUser(userId: string, properties?: Record<string, any>) {
  initPostHog();
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, properties);
}

// Pre-defined event names for type safety
export const Events = {
  MENU_VIEWED: "menu_viewed",
  ITEM_ADDED: "item_added_to_cart",
  CHECKOUT_STARTED: "checkout_started",
  ORDER_COMPLETED: "order_completed",
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  TRIAL_STARTED: "trial_started",
  PLAN_UPGRADED: "plan_upgraded",
  LOYALTY_EARNED: "loyalty_stamp_earned",
  PROMO_APPLIED: "promo_code_applied",
} as const;
