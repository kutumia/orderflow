/**
 * Module augmentation for next-auth — adds custom fields to JWT, Session, and User.
 * These fields are set in apps/web/src/lib/auth.ts and available throughout the app.
 */
import "next-auth";
import "next-auth/jwt";

type UserRole = "owner" | "manager" | "staff" | "admin";
type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getServerSession`, and received as a prop.
   * `session.user` includes all custom fields from the JWT token.
   */
  interface Session {
    /** Set to "UserNotFound" when the account is deleted mid-session. */
    error?: string;
    user: {
      id: string;
      email: string;
      name: string;
      restaurant_id: string;
      restaurant_slug: string;
      restaurant_name: string;
      role: UserRole;
      plan: string;
      subscription_status: SubscriptionStatus;
      trial_ends_at: string | null;
    };
  }

  /**
   * The object returned by the `authorize()` callback and passed to the `jwt` callback.
   */
  interface User {
    restaurant_id: string;
    restaurant_slug: string;
    restaurant_name: string;
    role: UserRole;
    plan: string;
    subscription_status: SubscriptionStatus;
    trial_ends_at: string | null;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and stored in the encrypted session cookie. */
  interface JWT {
    id: string;
    restaurant_id: string;
    restaurant_slug: string;
    restaurant_name: string;
    role: UserRole;
    plan: string;
    subscription_status: SubscriptionStatus;
    trial_ends_at: string | null;
    /** Unix timestamp (ms) of the last DB re-validation. */
    lastChecked: number;
    /** Set to "UserNotFound" if the account is deleted, to force client sign-out. */
    error?: string;
  }
}
