"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Zap, Sparkles, Crown, ChevronDown } from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import { PLANS, SETUP_FEE, type Plan } from "@/lib/feature-gates";

const FAQS = [
  {
    q: "How is OrderFlow different from Just Eat or Deliveroo?",
    a: "They charge 13–35% commission on every order. We charge a flat monthly fee with zero commission. You keep 100% of your order revenue and own your customer data.",
  },
  {
    q: "Is there a contract or lock-in period?",
    a: "No. All plans are month-to-month (or annual with 2 months free). Cancel anytime from your dashboard — no cancellation fees.",
  },
  {
    q: "What's included in the setup fee?",
    a: "Our team uploads your full menu, installs and configures your receipt printer, and trains your staff on the dashboard. We handle everything so you can focus on cooking.",
  },
  {
    q: "Can I upgrade or downgrade later?",
    a: "Yes. You can change plan at any time from your billing page. Upgrades take effect immediately with prorated billing. Downgrades apply at the end of your current billing period.",
  },
  {
    q: "Do I need special hardware?",
    a: "You need a thermal receipt printer (we recommend the Epson TM-T20III, ~£150) and a Windows PC or laptop to run our free printer agent. Network printers also supported.",
  },
  {
    q: "What payment methods do customers use?",
    a: "Customers pay via Stripe — all major credit/debit cards, Apple Pay, and Google Pay. Money goes directly to your bank account.",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const icons: Record<string, any> = { starter: Zap, growth: Sparkles, pro: Crown };
  const colours: Record<string, string> = {
    starter: "bg-blue-50 text-blue-600",
    growth: "bg-orange-50 text-orange-600",
    pro: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Log in</Link>
            <Link href="/register" className="btn-primary text-sm">Start Free Trial</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        {/* Heading */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Simple, honest pricing
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            No commission. No hidden fees. Just the tools your restaurant needs to grow.
          </p>
        </div>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={cn("text-sm font-medium", !annual ? "text-gray-900" : "text-gray-400")}>Monthly</span>
          <button onClick={() => setAnnual(!annual)}
            className={cn("relative w-12 h-6 rounded-full transition-colors", annual ? "bg-green-500" : "bg-gray-300")}>
            <div className={cn("absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform",
              annual ? "translate-x-6" : "translate-x-0.5"
            )} />
          </button>
          <span className={cn("text-sm font-medium", annual ? "text-gray-900" : "text-gray-400")}>
            Annual <span className="text-green-600 text-xs">(2 months free)</span>
          </span>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {(["starter", "growth", "pro"] as Plan[]).map((key) => {
            const plan = PLANS[key];
            const Icon = icons[key];
            const monthly = annual ? Math.round(plan.annualPrice / 12) : plan.price;
            const isPopular = key === "growth";

            return (
              <div key={key} className={cn(
                "bg-white rounded-2xl p-6 shadow-sm border relative flex flex-col",
                isPopular && "ring-2 ring-orange-400 shadow-md"
              )}>
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-orange-400 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-4", colours[key])}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>

                <div className="mb-1">
                  <span className="text-4xl font-bold">{formatPrice(monthly)}</span>
                  <span className="text-gray-400">/mo</span>
                </div>
                {annual && (
                  <p className="text-xs text-green-600 mb-4">
                    Billed {formatPrice(plan.annualPrice)}/year
                  </p>
                )}
                {!annual && <p className="text-xs text-gray-400 mb-4">Billed monthly</p>}

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={cn(
                  "w-full py-3 rounded-xl font-semibold text-sm text-center block transition-colors",
                  isPopular
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-brand-600 text-white hover:bg-brand-700"
                )}>
                  Start 14-Day Free Trial
                </Link>
              </div>
            );
          })}
        </div>

        {/* Setup fee */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border text-center mb-16">
          <h3 className="text-lg font-bold mb-2">Professional Setup — {formatPrice(SETUP_FEE)}</h3>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            We upload your menu, install your printer, and train your staff.
            One-time fee. You focus on cooking — we handle the tech.
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-medium pr-4">{faq.q}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform",
                    openFaq === i && "rotate-180"
                  )} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-gray-500 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold mb-3">Ready to stop paying commission?</h2>
          <p className="text-gray-500 mb-6">14-day free trial. No credit card required.</p>
          <Link href="/register" className="btn-primary text-base px-8 py-3 inline-block">
            Start Free Trial →
          </Link>
        </div>
      </main>
    </div>
  );
}
