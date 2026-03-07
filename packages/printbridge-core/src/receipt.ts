/**
 * ESC/POS Receipt Formatter for 80mm thermal printers.
 * Generates raw ESC/POS command bytes for printing order receipts.
 * 
 * Standard 80mm paper = 48 characters per line (Font A)
 * Standard 58mm paper = 32 characters per line (Font A)
 */

const ESC = "\x1B";
const GS = "\x1D";
const LF = "\x0A";

// Commands
const INIT = ESC + "@"; // Initialize printer
const CUT = GS + "V" + "\x41" + "\x03"; // Partial cut with feed
const BOLD_ON = ESC + "E" + "\x01";
const BOLD_OFF = ESC + "E" + "\x00";
const ALIGN_CENTER = ESC + "a" + "\x01";
const ALIGN_LEFT = ESC + "a" + "\x00";
const ALIGN_RIGHT = ESC + "a" + "\x02";
const DOUBLE_HEIGHT = ESC + "!" + "\x10";
const DOUBLE_WIDTH = ESC + "!" + "\x20";
const DOUBLE_SIZE = ESC + "!" + "\x30";
const NORMAL_SIZE = ESC + "!" + "\x00";
const FEED_2 = LF + LF;
const FEED_3 = LF + LF + LF;
const LINE_48 = "=".repeat(48);
const DASH_48 = "-".repeat(48);
const OPEN_DRAWER = ESC + "p" + "\x00" + "\x19" + "\xFA"; // Kick cash drawer

export interface ReceiptOrder {
  order_number: number;
  order_type: "delivery" | "collection";
  customer_name: string;
  customer_phone: string;
  delivery_address?: string | null;
  notes?: string | null;
  items: {
    name: string;
    quantity: number;
    price: number;
    modifiers?: { option: string; price: number }[];
    notes?: string | null;
  }[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  promo_code_used?: string | null;
  created_at: string;
  restaurant_name: string;
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : " ".repeat(len - str.length) + str;
}

function twoColumn(left: string, right: string, width = 48): string {
  const rightLen = right.length;
  const leftMax = width - rightLen - 1;
  return padRight(left, leftMax) + " " + right;
}

/**
 * Generate ESC/POS receipt string for a kitchen/customer order.
 */
export function formatKitchenReceipt(order: ReceiptOrder): string {
  const lines: string[] = [];

  // Initialize
  lines.push(INIT);

  // ── Header ──
  lines.push(ALIGN_CENTER);
  lines.push(DOUBLE_SIZE);
  lines.push(
    order.order_type === "delivery" ? "** DELIVERY **" : "** COLLECTION **"
  );
  lines.push(NORMAL_SIZE);
  lines.push(LF);
  lines.push(BOLD_ON);
  lines.push(DOUBLE_HEIGHT);
  lines.push(`ORDER #${order.order_number}`);
  lines.push(NORMAL_SIZE);
  lines.push(BOLD_OFF);
  lines.push(LF);

  // Time
  const orderTime = new Date(order.created_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const orderDate = new Date(order.created_at).toLocaleDateString("en-GB");
  lines.push(`${orderDate}  ${orderTime}`);
  lines.push(LF);
  lines.push(ALIGN_LEFT);
  lines.push(LINE_48);
  lines.push(LF);

  // ── Customer info ──
  lines.push(BOLD_ON);
  lines.push(`Customer: ${order.customer_name}`);
  lines.push(BOLD_OFF);
  lines.push(LF);
  lines.push(`Phone: ${order.customer_phone}`);
  lines.push(LF);

  if (order.order_type === "delivery" && order.delivery_address) {
    lines.push(`Address: ${order.delivery_address}`);
    lines.push(LF);
  }
  lines.push(LINE_48);
  lines.push(LF);

  // ── Items ──
  for (const item of order.items) {
    lines.push(BOLD_ON);
    lines.push(
      twoColumn(
        `${item.quantity}x ${item.name}`,
        formatPrice(item.price * item.quantity)
      )
    );
    lines.push(BOLD_OFF);
    lines.push(LF);

    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modPrice = mod.price > 0 ? ` +${formatPrice(mod.price)}` : "";
        lines.push(`   + ${mod.option}${modPrice}`);
        lines.push(LF);
      }
    }

    // Item notes
    if (item.notes) {
      lines.push(`   NOTE: ${item.notes}`);
      lines.push(LF);
    }
  }

  lines.push(DASH_48);
  lines.push(LF);

  // ── Totals ──
  lines.push(twoColumn("Subtotal", formatPrice(order.subtotal)));
  lines.push(LF);

  if (order.delivery_fee > 0) {
    lines.push(twoColumn("Delivery", formatPrice(order.delivery_fee)));
    lines.push(LF);
  }

  if (order.discount > 0) {
    lines.push(twoColumn("Discount", `-${formatPrice(order.discount)}`));
    lines.push(LF);
  }

  lines.push(LINE_48);
  lines.push(LF);
  lines.push(BOLD_ON);
  lines.push(DOUBLE_HEIGHT);
  lines.push(twoColumn("TOTAL", formatPrice(order.total)));
  lines.push(NORMAL_SIZE);
  lines.push(BOLD_OFF);
  // VAT line
  if ((order as any).vat_amount && (order as any).vat_amount > 0) {
    lines.push(twoColumn("incl. VAT", formatPrice((order as any).vat_amount)));
  }
  lines.push(LF);
  lines.push(LINE_48);
  lines.push(LF);

  // ── Order notes ──
  if (order.notes) {
    lines.push(BOLD_ON);
    lines.push("ORDER NOTES:");
    lines.push(BOLD_OFF);
    lines.push(LF);
    lines.push(order.notes);
    lines.push(LF);
    lines.push(DASH_48);
    lines.push(LF);
  }

  // ── Footer ──
  lines.push(ALIGN_CENTER);
  lines.push(`Powered by OrderFlow`);
  lines.push(LF);
  lines.push(FEED_3);
  lines.push(CUT);

  return lines.join("");
}

/**
 * Generate a plain text version of the receipt (for preview/fallback).
 */
export function formatPlainTextReceipt(order: ReceiptOrder): string {
  const lines: string[] = [];
  const w = 48;

  lines.push("=".repeat(w));
  lines.push(
    `  ${order.order_type === "delivery" ? "DELIVERY" : "COLLECTION"}  ORDER #${order.order_number}`
  );
  lines.push("=".repeat(w));

  const orderTime = new Date(order.created_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  lines.push(`  ${new Date(order.created_at).toLocaleDateString("en-GB")}  ${orderTime}`);
  lines.push("");
  lines.push(`  Customer: ${order.customer_name}`);
  lines.push(`  Phone:    ${order.customer_phone}`);
  if (order.order_type === "delivery" && order.delivery_address) {
    lines.push(`  Address:  ${order.delivery_address}`);
  }
  lines.push("-".repeat(w));

  for (const item of order.items) {
    lines.push(
      twoColumn(`  ${item.quantity}x ${item.name}`, formatPrice(item.price * item.quantity), w)
    );
    if (item.modifiers) {
      for (const mod of item.modifiers) {
        lines.push(`     + ${mod.option}${mod.price > 0 ? ` (+${formatPrice(mod.price)})` : ""}`);
      }
    }
    if (item.notes) lines.push(`     NOTE: ${item.notes}`);
  }

  lines.push("-".repeat(w));
  lines.push(twoColumn("  Subtotal", formatPrice(order.subtotal), w));
  if (order.delivery_fee > 0) lines.push(twoColumn("  Delivery", formatPrice(order.delivery_fee), w));
  if (order.discount > 0) lines.push(twoColumn("  Discount", `-${formatPrice(order.discount)}`, w));
  lines.push("=".repeat(w));
  lines.push(twoColumn("  TOTAL", formatPrice(order.total), w));
  lines.push("=".repeat(w));

  if (order.notes) {
    lines.push("");
    lines.push(`  NOTE: ${order.notes}`);
  }

  lines.push("");
  return lines.join("\n");
}
