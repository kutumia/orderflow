import { escapeHtml } from "@/lib/validation";
import { log } from "@/lib/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "OrderFlow <orders@orderflow.co.uk>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!RESEND_API_KEY) {
    log.warn("RESEND_API_KEY not set — skipping email", { to });
    return { success: false, error: "API key not configured" };
  }

  // Try up to 2 times (initial + 1 retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      });

      if (res.ok) {
        return { success: true };
      }

      const err = await res.json();
      log.error("Resend API error", { attempt: attempt + 1, to, error: err });

      // Don't retry on 4xx client errors (bad request, invalid email, etc.)
      if (res.status >= 400 && res.status < 500) {
        return { success: false, error: err };
      }

      // Retry on 5xx server errors
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000)); // Wait 1s before retry
      }
    } catch (err) {
      log.error("Email send failed", { attempt: attempt + 1, to, error: String(err) });
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  return { success: false, error: "Email failed after 2 attempts" };
}

export function orderConfirmationEmail(order: {
  order_number: number;
  customer_name: string;
  restaurant_name: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  order_type: string;
  estimated_mins: number;
}) {
  const fp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
  const itemRows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${i.quantity}x ${escapeHtml(i.name)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${fp(i.price * i.quantity)}</td></tr>`
    )
    .join("");

  return {
    subject: `Order #${order.order_number} confirmed — ${order.restaurant_name}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f5f5f5">
<div style="max-width:500px;margin:0 auto;padding:20px">
<div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

<div style="background:#1B4F72;padding:24px;text-align:center">
  <h1 style="color:white;margin:0;font-size:20px">Order Confirmed ✓</h1>
</div>

<div style="padding:24px">
  <p style="margin:0 0 4px;color:#666;font-size:14px">Hi ${escapeHtml(order.customer_name)},</p>
  <p style="margin:0 0 20px;color:#666;font-size:14px">Your order from <strong>${escapeHtml(order.restaurant_name)}</strong> has been received.</p>

  <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:20px">
    <div style="font-size:13px;color:#666;margin-bottom:4px">Order #${order.order_number}</div>
    <div style="font-size:13px;color:#666">${order.order_type === "delivery" ? "🚗 Delivery" : "🏪 Collection"} · Est. ${order.estimated_mins} mins</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${itemRows}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
    <tr><td style="padding:4px 0;color:#666">Subtotal</td><td style="text-align:right">${fp(order.subtotal)}</td></tr>
    ${order.delivery_fee > 0 ? `<tr><td style="padding:4px 0;color:#666">Delivery</td><td style="text-align:right">${fp(order.delivery_fee)}</td></tr>` : ""}
    ${order.discount > 0 ? `<tr><td style="padding:4px 0;color:#27ae60">Discount</td><td style="text-align:right;color:#27ae60">-${fp(order.discount)}</td></tr>` : ""}
    <tr><td style="padding:12px 0 0;font-weight:700;font-size:16px;border-top:2px solid #eee">Total</td><td style="padding:12px 0 0;font-weight:700;font-size:16px;text-align:right;border-top:2px solid #eee">${fp(order.total)}</td></tr>
  </table>
</div>

<div style="padding:16px 24px;background:#f8f9fa;text-align:center;font-size:12px;color:#999">
  Powered by OrderFlow
</div>
</div>
</div>
</body>
</html>`,
  };
}
