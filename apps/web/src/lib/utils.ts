// ──────────────────────────────────────
// Shared utilities
// ──────────────────────────────────────

/**
 * Generate a URL-safe slug from a restaurant name.
 * "Mario's Pizza & Pasta" → "marios-pizza-pasta"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[']/g, "") // remove apostrophes
    .replace(/&/g, "and") // & → and
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphens
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .substring(0, 60); // max length
}

/**
 * Add a random suffix to ensure slug uniqueness.
 * "marios-pizza" → "marios-pizza-a3f2"
 */
export function makeSlugUnique(slug: string): string {
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}

/**
 * Format pence to pounds string: 1299 → "£12.99"
 */
export function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * Format a date string to readable UK format.
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date string to readable UK date + time.
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate UK phone number (basic check).
 */
export function isValidUKPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^(\+44|0)[0-9]{9,10}$/.test(cleaned);
}

/**
 * Classnames helper (tiny cn utility).
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Get the day name from day number.
 */
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function getDayName(dayOfWeek: number): string {
  return DAYS[dayOfWeek] || "";
}

/**
 * Calculate trial days remaining.
 */
export function trialDaysRemaining(trialEndsAt: string): number {
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
