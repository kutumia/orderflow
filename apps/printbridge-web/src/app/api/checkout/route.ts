import { NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test_placeholder') || key === 'sk_test_placeholder') {
    throw new Error('STRIPE_SECRET_KEY is not configured. Set it in environment.');
  }
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const body = await req.json();
    const tenantId = body?.tenantId;
    const email = body?.email;
    const plan = body?.plan ?? 'pro';

    if (!tenantId || !email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'tenantId and email are required' },
        { status: 400 }
      );
    }

    // In production, require authenticated dashboard user and derive tenantId from session
    const priceId = plan === 'pro' ? 'price_pb_pro_monthly' : 'price_pb_enterprise_monthly';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard`,
      customer_email: email,
      client_reference_id: String(tenantId),
      metadata: { tenantId: String(tenantId), product: 'printbridge' },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe checkout failed';
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
