import { NextResponse } from 'next/server';
import crypto from 'crypto';

// In production, verify the webhook HMAC; logic shared with @orderflow/core-infra
function verifyShopifyHmac(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmacHeader, 'base64'), Buffer.from(computed, 'base64'));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const topic = req.headers.get('x-shopify-topic');
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const shop = req.headers.get('x-shopify-shop-domain');

    const rawBody = await req.text();
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET;
    if (!secret || !verifyShopifyHmac(rawBody, hmacHeader, secret)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const orderData = JSON.parse(rawBody);

    console.log(`[Shopify Webhook] Received ${topic} for shop: ${shop}`);

    if (topic === 'orders/create') {
      // 1. Map Shopify Order -> OrderFlow Print Job
      console.log('Processing new Shopify order:', orderData.id);

      const items = orderData.line_items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        modifiers: item.properties?.map((p: { name: string; value: string }) => `${p.name}: ${p.value}`) || []
      }));

      const templateData = {
        orderId: `SHP-${orderData.order_number}`,
        customerName: `${orderData.customer?.first_name || ''} ${orderData.customer?.last_name || ''}`.trim(),
        restaurantName: shop || 'Shopify Store',
        date: new Date(orderData.created_at).toLocaleString(),
        items,
        tax: parseFloat(orderData.current_total_tax),
        total: parseFloat(orderData.current_total_price),
      };

      // 2. Transmit to PrintBridge queue
      // await createJob({
      //   tenantId: 'resolved_tenant_id',
      //   restaurantId: 'resolved_restaurant_id',
      //   receiptData: JSON.stringify(templateData)
      // });

      console.log('Successfully dispatched Shopify order to PrintBridge:', templateData.orderId);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('Webhook processing failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
