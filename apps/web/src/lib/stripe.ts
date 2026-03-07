import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
  typescript: true,
});

// Platform fee: 1.5% of each order
export const PLATFORM_FEE_PERCENT = 1.5;

export function calculatePlatformFee(amountPence: number): number {
  return Math.round(amountPence * (PLATFORM_FEE_PERCENT / 100));
}

export async function createConnectAccount(
  restaurantId: string,
  email: string,
  businessName: string
) {
  return stripe.accounts.create({
    type: "express",
    country: "GB",
    email,
    business_type: "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      name: businessName,
      mcc: "5812",
      product_description: "Food ordering and delivery",
    },
    metadata: { restaurant_id: restaurantId },
  });
}

export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
) {
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return link.url;
}

export async function isAccountReady(accountId: string): Promise<boolean> {
  const account = await stripe.accounts.retrieve(accountId);
  return !!(account.charges_enabled && account.payouts_enabled);
}

export async function createPaymentIntent(
  amountPence: number,
  restaurantStripeAccountId: string,
  metadata: Record<string, string>
) {
  const platformFee = Math.round(amountPence * (PLATFORM_FEE_PERCENT / 100));
  return stripe.paymentIntents.create({
    amount: amountPence,
    currency: "gbp",
    payment_method_types: ["card"],
    application_fee_amount: platformFee,
    transfer_data: { destination: restaurantStripeAccountId },
    metadata,
  });
}

export async function refundPayment(paymentIntentId: string, reason?: string) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    reason: "requested_by_customer",
    metadata: { reason: reason || "Owner-initiated refund" },
  });
}

export async function createDashboardLink(accountId: string) {
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}
