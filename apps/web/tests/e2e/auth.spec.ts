/**
 * E2E Auth Flow Tests
 *
 * Tests the login page, redirect behaviour for unauthenticated users,
 * form validation, and signup page accessibility.
 *
 * Run against a running dev server:
 *   npx playwright test tests/e2e/auth.spec.ts
 */

import { test, expect } from "@playwright/test";

// ── Login page ─────────────────────────────────────────────────────────────────

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders the login form with email and password fields", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows a validation error when submitting empty form", async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    // HTML5 required validation or JS error message
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();
  });

  test("shows an error message for incorrect credentials", async ({ page }) => {
    await page.locator('input[type="email"]').fill("nonexistent@test.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.locator('button[type="submit"]').click();

    // Wait for error feedback — accept any visible error state
    const errorLocator = page.locator('[role="alert"], .error, [data-testid="error"]');
    await expect(errorLocator.or(page.getByText(/invalid|incorrect|wrong/i))).toBeVisible({
      timeout: 10_000,
    });
  });

  test("has a link to the signup / registration page", async ({ page }) => {
    const signupLink = page.getByRole("link", { name: /sign up|register|create account/i });
    await expect(signupLink).toBeVisible();
  });
});

// ── Protected route redirects ──────────────────────────────────────────────────

test.describe("Unauthenticated access to protected routes", () => {
  const protectedRoutes = [
    "/dashboard",
    "/dashboard/orders",
    "/dashboard/menu",
    "/dashboard/staff",
    "/dashboard/settings",
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }
});

// ── Registration page ──────────────────────────────────────────────────────────

test.describe("Registration page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  test("renders the registration form", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows error when password is too short", async ({ page }) => {
    // Fill all required fields with a short password
    const inputs = page.locator("input");
    const count = await inputs.count();

    // Fill text inputs
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute("type");
      if (type === "password") {
        await input.fill("short");
      } else if (type === "email") {
        await input.fill("test@example.com");
      } else if (type === "text") {
        await input.fill("Test Value");
      }
    }

    await page.locator('button[type="submit"]').click();

    // Should show password length error
    const errorText = page.getByText(/8 characters|password.*short|too short/i);
    // Either client-side validation or server error
    await expect(errorText.or(page.locator('[role="alert"]'))).toBeVisible({ timeout: 8_000 });
  });
});

// ── Public restaurant ordering page ───────────────────────────────────────────

test.describe("Public pages (no auth required)", () => {
  test("home page or marketing page loads without redirect", async ({ page }) => {
    const response = await page.goto("/");
    // Should not redirect to login
    expect(page.url()).not.toContain("/login");
    // Page should load successfully
    expect(response?.status()).toBeLessThan(500);
  });
});
