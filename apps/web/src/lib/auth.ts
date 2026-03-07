import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "./supabase";

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

        const restaurant = user.restaurants as any;

        // Return user object (becomes the JWT token)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          restaurant_id: user.restaurant_id,
          restaurant_slug: restaurant?.slug || "",
          restaurant_name: restaurant?.name || "",
          role: user.role,
          subscription_status: restaurant?.subscription_status || "trialing",
          plan: restaurant?.plan || "starter",
          trial_ends_at: restaurant?.trial_ends_at || null,
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
      // On initial sign-in, add custom fields to token
      if (user) {
        token.id = user.id;
        token.restaurant_id = (user as any).restaurant_id;
        token.restaurant_slug = (user as any).restaurant_slug;
        token.restaurant_name = (user as any).restaurant_name;
        token.role = (user as any).role;
        token.plan = (user as any).plan;
        token.subscription_status = (user as any).subscription_status;
        token.trial_ends_at = (user as any).trial_ends_at;
      }
      return token;
    },

    async session({ session, token }) {
      // Make custom fields available in session
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).restaurant_id = token.restaurant_id;
        (session.user as any).restaurant_slug = token.restaurant_slug;
        (session.user as any).restaurant_name = token.restaurant_name;
        (session.user as any).role = token.role;
        (session.user as any).plan = token.plan;
        (session.user as any).subscription_status = token.subscription_status;
        (session.user as any).trial_ends_at = token.trial_ends_at;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};
