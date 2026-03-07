"use client";

import Link from "next/link";
import {
  ShoppingBag, PoundSterling, Users, Printer, BarChart3, Gift,
  ChevronRight, Star, Shield, Zap, Check, ArrowRight,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { PLANS } from "@/lib/feature-gates";

const FEATURES = [
  { icon: ShoppingBag, title: "Direct Online Ordering", desc: "Your own branded ordering page. Delivery and collection. Mobile-optimised." },
  { icon: PoundSterling, title: "Zero Commission", desc: "Flat monthly fee. You keep 100% of every order. No per-order charges." },
  { icon: Printer, title: "Kitchen Printing", desc: "Orders print automatically on your receipt printer. No tablet needed." },
  { icon: Users, title: "Own Your Customers", desc: "Build your customer database. No middleman between you and your regulars." },
  { icon: Gift, title: "Loyalty & Marketing", desc: "Stamp cards, email campaigns, promo codes. Turn first-timers into regulars." },
  { icon: BarChart3, title: "Business Insights", desc: "Revenue reports, top items, peak hours. Know what's working." },
];

const SOCIAL_PROOF = [
  { name: "Mario's Pizzeria", quote: "We saved over £1,200 in our first month by switching from Deliveroo.", location: "Leeds" },
  { name: "Spice Kitchen", quote: "The printer setup took 10 minutes. Orders just started flowing.", location: "Manchester" },
  { name: "The Fish Bar", quote: "Our customers love ordering direct. And we love keeping the commission.", location: "Hull" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-brand-600">OrderFlow</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <a href="#testimonials" className="hover:text-gray-900">Testimonials</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">Log in</Link>
            <Link href="/register" className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium mb-6">
          <Zap className="h-3 w-3" /> 14-day free trial · No credit card required
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-5 leading-tight">
          Stop paying 30% to<br />
          <span className="text-brand-600">Just Eat & Deliveroo</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-8">
          Your own online ordering system for a flat monthly fee.
          Zero commission. Orders print in your kitchen automatically.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Link href="/register" className="bg-brand-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-brand-700 transition-colors flex items-center gap-2">
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/demo-restaurant" className="border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl text-base font-medium hover:bg-gray-50 transition-colors">
            See Live Demo
          </Link>
        </div>
        <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
          <span className="flex items-center gap-1"><Check className="h-4 w-4 text-green-500" /> No commission</span>
          <span className="flex items-center gap-1"><Check className="h-4 w-4 text-green-500" /> Cancel anytime</span>
          <span className="flex items-center gap-1"><Check className="h-4 w-4 text-green-500" /> From {formatPrice(PLANS.starter.price)}/mo</span>
        </div>
      </section>

      {/* Commission comparison */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">See how much you save</h2>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="grid grid-cols-3 text-center text-sm font-medium bg-gray-50 border-b">
              <div className="p-4">Monthly orders</div>
              <div className="p-4 text-red-600">Just Eat (25%)</div>
              <div className="p-4 text-green-600">OrderFlow</div>
            </div>
            {[
              { orders: 200, avg: 2000 },
              { orders: 400, avg: 2000 },
              { orders: 600, avg: 2000 },
            ].map((r) => {
              const revenue = r.orders * r.avg;
              const commission = Math.round(revenue * 0.25);
              return (
                <div key={r.orders} className="grid grid-cols-3 text-center border-b last:border-0">
                  <div className="p-4 text-sm">
                    <span className="font-medium">{r.orders}</span>
                    <span className="text-gray-400 text-xs block">{formatPrice(revenue)} revenue</span>
                  </div>
                  <div className="p-4 text-red-600 font-semibold">{formatPrice(commission)}</div>
                  <div className="p-4 text-green-600 font-semibold">{formatPrice(PLANS.starter.price)}</div>
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm text-gray-400 mt-4">Based on {formatPrice(2000)} average order value</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Everything you need to take orders direct</h2>
        <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
          From ordering to kitchen printing to customer loyalty — all in one platform.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors">
              <div className="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-brand-600" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Trusted by independent restaurants</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {SOCIAL_PROOF.map((t, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 text-yellow-400" fill="currentColor" />
                  ))}
                </div>
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-gray-400"> · {t.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-3">Simple, honest pricing</h2>
        <p className="text-gray-500 mb-8">From {formatPrice(PLANS.starter.price)}/month. No commission. No hidden fees.</p>
        <Link href="/pricing" className="bg-brand-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors inline-flex items-center gap-2">
          View Plans <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Final CTA */}
      <section className="bg-brand-600 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to keep 100% of your orders?
          </h2>
          <p className="text-brand-100 mb-8 text-lg">
            14-day free trial. Set up in 30 minutes. Cancel anytime.
          </p>
          <Link href="/register" className="bg-white text-brand-600 px-10 py-4 rounded-xl text-lg font-bold hover:bg-gray-50 transition-colors inline-flex items-center gap-2">
            Start Free Trial <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span>© {new Date().getFullYear()} OrderFlow. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
