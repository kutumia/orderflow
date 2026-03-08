import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "./supabase";

const JWT_REVALIDATE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // Fetch user with their restaurant data
        const { data: user, error } = await supabaseAdmin
          .from("users")
          .select(
            `
            id,
            email,
            name,
            password_hash,
            role,
            restaurant_id,
            restaurants (
              id,
              name,
              slug,
              is_active,
              subscription_status,
              trial_ends_at,
              plan
            )
          `
          )
          .eq("email", credentials.email.toLowerCase().trim())
          .single();

        if (error || !user) {
          throw new Error("Invalid email or password");
        }

        // Verify password
        const isValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        const restaurant = user.restaurants as {
          slug: string;
          name: string;
          is_active: boolean;
          subscription_status: string;
          trial_ends_at: string | null;
          plan: string;
        } | null;

        // Return user object (becomes the JWT token)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          restaurant_id: user.restaurant_id,
          restaurant_slug: restaurant?.slug ?? "",
          restaurant_name: restaurant?.name ?? "",
          role: user.role as "owner" | "manager" | "staff" | "admin",
          subscription_status: (restaurant?.subscription_status ?? "trialing") as
            | "trialing"
            | "active"
            | "past_due"
            | "cancelled",
          plan: restaurant?.plan ?? "starter",
          trial_ends_at: restaurant?.trial_ends_at ?? null,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, populate token and set lastChecked
      if (user) {
        token.id = user.id;
        token.restaurant_id = user.restaurant_id;
        token.restaurant_slug = user.restaurant_slug;
        token.restaurant_name = user.restaurant_name;
        token.role = user.role;
        token.plan = user.plan;
        token.subscription_status = user.subscription_status;
        token.trial_ends_at = user.trial_ends_at;
        token.lastChecked = Date.now();
        return token;
      }

      // Re-validate from DB every 15 minutes so stale JWT data
      // (cancelled subscriptions, role changes, account deletions) gets refreshed.
      const lastChecked = (token.lastChecked as number) || 0;
      if (Date.now() - lastChecked > JWT_REVALIDATE_INTERVAL_MS) {
        const { data: freshUser } = await supabaseAdmin
          .from("users")
          .select(
            `id, role, restaurant_id,
             restaurants ( subscription_status, trial_ends_at, plan, name, slug )`
          )
          .eq("id", token.id as string)
          .single();

        if (!freshUser) {
          // User deleted or deactivated — mark token invalid so session callback
          // can surface this and force a sign-out.
          token.error = "UserNotFound";
          return token;
        }

        const r = freshUser.restaurants as {
          subscription_status: string;
          trial_ends_at: string | null;
          plan: string;
          name: string;
          slug: string;
        } | null;
        token.role = freshUser.role;
        token.restaurant_id = freshUser.restaurant_id;
        token.subscription_status = r?.subscription_status ?? token.subscription_status;
        token.trial_ends_at = r?.trial_ends_at ?? token.trial_ends_at;
        token.plan = r?.plan ?? token.plan;
        token.restaurant_name = r?.name ?? token.restaurant_name;
        token.restaurant_slug = r?.slug ?? token.restaurant_slug;
        token.lastChecked = Date.now();
      }

      return token;
    },

    async session({ session, token }) {
      // Surface the error so clients can force a sign-out if the account is gone
      if (token.error) {
        session.error = token.error;
      }

      // Make fresh token fields available in session
      if (session.user) {
        session.user.id = token.id;
        session.user.restaurant_id = token.restaurant_id;
        session.user.restaurant_slug = token.restaurant_slug;
        session.user.restaurant_name = token.restaurant_name;
        session.user.role = token.role;
        session.user.plan = token.plan;
        session.user.subscription_status = token.subscription_status;
        session.user.trial_ends_at = token.trial_ends_at;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};
