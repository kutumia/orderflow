/**
 * Input validation & sanitization helpers for OrderFlow API routes.
 *
 * Usage:
 *   import { validate, escapeHtml } from "@/lib/validation";
 *   const err = validate.length(body.name, "Name", 1, 100);
 *   if (err) return NextResponse.json({ error: err }, { status: 400 });
 */

/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strip control characters (except newline, tab) from user input.
 */
export function stripControlChars(str: string): string {
  if (!str) return "";
  // Keep \n (0x0A) and \t (0x09), strip everything else below 0x20 except space
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Validate string length. Returns error message or null if valid.
 */
export function validateLength(
  value: string | null | undefined,
  fieldName: string,
  min: number,
  max: number
): string | null {
  if (!value || value.trim().length < min) {
    return `${fieldName} must be at least ${min} character${min === 1 ? "" : "s"}`;
  }
  if (value.length > max) {
    return `${fieldName} must be ${max} characters or fewer`;
  }
  return null;
}

/**
 * Validate email format. Returns error message or null if valid.
 */
export function validateEmail(email: string | null | undefined): string | null {
  if (!email) return "Email is required";
  if (email.length > 254) return "Email is too long";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return null;
}

/**
 * Validate UK phone number. Returns error message or null if valid.
 */
export function validatePhone(phone: string | null | undefined): string | null {
  if (!phone) return "Phone number is required";
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.length > 20) return "Phone number is too long";
  if (!/^(\+44|0)[0-9]{9,10}$/.test(cleaned)) return "Invalid UK phone number";
  return null;
}

/**
 * Validate a UUID format.
 */
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Sanitize all string fields in an object — trim and strip control chars.
 */
export function sanitizeInput<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === "string") {
      (result as any)[field] = stripControlChars(val.trim());
    }
  }
  return result;
}

/**
 * Batch validate multiple fields. Returns first error found or null.
 */
export function validateCheckoutInput(body: {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  delivery_address?: string;
  notes?: string;
}): string | null {
  const nameErr = validateLength(body.customer_name, "Name", 1, 100);
  if (nameErr) return nameErr;

  const emailErr = validateEmail(body.customer_email);
  if (emailErr) return emailErr;

  const phoneErr = validatePhone(body.customer_phone);
  if (phoneErr) return phoneErr;

  if (body.delivery_address && body.delivery_address.length > 500) {
    return "Delivery address must be 500 characters or fewer";
  }

  if (body.notes && body.notes.length > 500) {
    return "Order notes must be 500 characters or fewer";
  }

  return null;
}
