/**
 * Route guard utilities for authenticated dashboard API routes.
 *
 * Every dashboard route must call one of these guards before touching
 * any data. They provide:
 *   1. Session presence check
 *   2. Role enforcement
 *   3. DB-verified restaurant ownership (second factor beyond stale JWT)
 *
 * ## Role Hierarchy & Access Policy
 *
 * | Guard           | Allowed roles          | Typical use                          |
 * |-----------------|------------------------|--------------------------------------|
 * | requireSession  | owner, manager, staff  | Read-only views (orders, kitchen)    |
 * | requireManager  | owner, manager         | Menu, categories, hours mutations    |
 * | requireOwner    | owner only             | Staff mgmt, billing, settings, refunds |
 *
 * Staff is a read-only role. Staff can view orders and kitchen status but
 * cannot modify menu items, categories, hours, restaurant settings, staff
 * accounts, or initiate refunds. Routes that mutate those resources use
 * requireManager() or requireOwner() — never requireSession().
 *
 * Usage:
 *   const guard = await requireSession(req);
 *   if (!guard.ok) return guard.response;
 *   const { session, restaurantId } = guard;
 *
 *   const ownerGuard = await requireOwner(req);
 *   if (!ownerGuard.ok) return ownerGuard.response;
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { log } from "@/lib/logger";

type GuardSuccess = {
  ok: true;
  session: Session;
  user: {
    id: string;
    role: string;
    restaurant_id: string;
    plan: string;
    subscription_status: string;
  };
  restaurantId: string;
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

export type GuardResult = GuardSuccess | GuardFailure;

/**
 * Verify the request has a valid session and that the session's restaurant_id
 * is actually owned by the session user in the DB (prevents stale JWT abuse).
 *
 * Accepts any authenticated role (owner, manager, staff).
 */
export async function requireSession(req: NextRequest): Promise<GuardResult> {
  const session = await getServerSession(authOptions);

  // Check session error (set by jwt callback when user is deleted)
  if (session?.error === "UserNotFound") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Session expired" }, { status: 401 }),
    };
  }

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = session.user;

  // DB re-verification: confirm user still exists and still owns this restaurant
  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("id, role, restaurant_id")
    .eq("id", user.id)
    .single();

  if (!dbUser) {
    log.warn("Session user not found in DB", { userId: user.id });
    return {
      ok: false,
      response: NextResponse.json({ error: "Account not found" }, { status: 401 }),
    };
  }

  if (dbUser.restaurant_id !== user.restaurant_id) {
    log.warn("JWT restaurant_id mismatch with DB", {
      userId: user.id,
      jwtRestaurantId: user.restaurant_id,
      dbRestaurantId: dbUser.restaurant_id,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    session,
    user: {
      id: dbUser.id,
      role: dbUser.role,
      restaurant_id: dbUser.restaurant_id,
      plan: user.plan,
      subscription_status: user.subscription_status,
    },
    restaurantId: dbUser.restaurant_id,
  };
}

/**
 * Same as requireSession but additionally enforces that the user is an owner.
 */
export async function requireOwner(req: NextRequest): Promise<GuardResult> {
  const result = await requireSession(req);
  if (!result.ok) return result;

  if (result.user.role !== "owner") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Owner access required" }, { status: 403 }),
    };
  }

  return result;
}

/**
 * Same as requireSession but additionally enforces owner or manager role.
 */
export async function requireManager(req: NextRequest): Promise<GuardResult> {
  const result = await requireSession(req);
  if (!result.ok) return result;

  if (!["owner", "manager"].includes(result.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Manager access required" }, { status: 403 }),
    };
  }

  return result;
}
