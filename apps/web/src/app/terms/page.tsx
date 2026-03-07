import Link from "next/link";
import { Utensils, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Utensils className="h-6 w-6 text-brand-600" />
            <span className="text-lg font-bold">OrderFlow</span>
          </Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-sm text-brand-600 flex items-center gap-1 mb-6 hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">
          Last updated: February 2026
        </p>

        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
          <p className="text-gray-600 mb-4">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the OrderFlow
            platform (&ldquo;Service&rdquo;), operated by OrderFlow Ltd (&ldquo;we&rdquo;,
            &ldquo;our&rdquo;, &ldquo;us&rdquo;). By registering for an account, you agree to
            these Terms.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            2. Service Description
          </h2>
          <p className="text-gray-600 mb-4">
            OrderFlow provides a technology platform enabling restaurants to
            create branded online ordering websites, receive and manage orders,
            and process payments. OrderFlow is a technology provider only. We do
            not prepare, handle, or deliver food.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            3. Restaurant Responsibilities
          </h2>
          <p className="text-gray-600 mb-4">
            As a restaurant using OrderFlow, you are solely responsible for: food
            safety and hygiene compliance, accurate allergen information on all
            menu items (in accordance with Natasha&apos;s Law), food preparation and
            quality, delivery of orders (if offering delivery), compliance with
            all applicable local regulations and licensing, and the accuracy of
            your menu pricing.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            4. Subscription & Billing
          </h2>
          <p className="text-gray-600 mb-4">
            The Service is provided on a monthly subscription basis. Pricing is
            as displayed on our website at the time of signup. We offer a 14-day
            free trial for new accounts. After the trial period, your chosen plan
            will be charged monthly via Stripe. You may cancel at any time; the
            service will remain active until the end of the current billing
            period.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            5. Limitation of Liability
          </h2>
          <p className="text-gray-600 mb-4">
            OrderFlow is a technology provider, not a food vendor. Our total
            liability to you is limited to the amount you have paid in
            subscription fees during the 12 months prior to the claim. We are
            not liable for any food-related incidents, delivery failures, or
            losses arising from your use of the platform.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">6. Termination</h2>
          <p className="text-gray-600 mb-4">
            We may suspend or terminate your account if you breach these Terms,
            fail to pay subscription fees, or if your use of the Service poses a
            risk to other users. You may terminate your account at any time by
            cancelling your subscription from the dashboard.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            7. Changes to Terms
          </h2>
          <p className="text-gray-600 mb-4">
            We may update these Terms from time to time. We will notify you of
            material changes via email or through the dashboard. Continued use
            of the Service after changes constitutes acceptance.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">8. Governing Law</h2>
          <p className="text-gray-600 mb-4">
            These Terms are governed by the laws of England and Wales. Any
            disputes will be subject to the exclusive jurisdiction of the courts
            of England and Wales.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">9. Contact</h2>
          <p className="text-gray-600 mb-4">
            For questions about these Terms, contact us at
            legal@orderflow.co.uk.
          </p>
        </div>
      </main>
    </div>
  );
}
