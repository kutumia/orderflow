import Link from "next/link";
import { Utensils, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">
          Last updated: February 2026
        </p>

        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Who We Are</h2>
          <p className="text-gray-600 mb-4">
            OrderFlow Ltd (&ldquo;OrderFlow&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;) is the
            data controller for information we collect through our platform. For
            customer order data, we act as a data processor on behalf of the
            restaurant (the data controller).
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            2. Data We Collect
          </h2>
          <p className="text-gray-600 mb-2">
            <strong>Restaurant owners:</strong> Name, email, phone, business
            address, payment information (processed by Stripe), login
            credentials.
          </p>
          <p className="text-gray-600 mb-4">
            <strong>Customers placing orders:</strong> Name, email, phone,
            delivery address (if applicable), order history, payment information
            (processed by Stripe — we do not store card numbers).
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            3. How We Use Your Data
          </h2>
          <p className="text-gray-600 mb-4">
            We use personal data to: provide and maintain the Service, process
            orders and payments, send order confirmations and updates,
            communicate about your account and subscription, improve our Service,
            and comply with legal obligations. We do not sell personal data to
            third parties.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            4. Data Sharing
          </h2>
          <p className="text-gray-600 mb-4">
            We share data with: Stripe (payment processing), Resend (email
            delivery), Supabase (database hosting), and Vercel (website
            hosting). All processors are GDPR-compliant and data is processed
            within the UK/EEA or under adequate safeguards.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            5. Your Rights (UK GDPR)
          </h2>
          <p className="text-gray-600 mb-4">
            Under UK GDPR, you have the right to: access your personal data,
            rectify inaccurate data, erase your data (&ldquo;right to be
            forgotten&rdquo;), restrict processing, data portability (receive
            your data in a machine-readable format), object to processing, and
            withdraw consent at any time. To exercise any of these rights,
            contact us at privacy@orderflow.co.uk or use the data management
            tools in your account settings.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            6. Data Retention
          </h2>
          <p className="text-gray-600 mb-4">
            We retain restaurant account data for as long as the account is
            active and for 6 years after closure (for tax and legal
            obligations). Customer order data is retained for 6 years for tax
            compliance. Personal identifying information can be deleted upon
            request while retaining anonymised order records.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">7. Cookies</h2>
          <p className="text-gray-600 mb-4">
            We use essential cookies for authentication and session management.
            Optional analytics cookies help us understand how the Service is
            used. You can manage your cookie preferences through the consent
            banner shown on first visit.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">8. Security</h2>
          <p className="text-gray-600 mb-4">
            We implement appropriate technical and organisational measures to
            protect personal data, including encryption in transit (TLS/HTTPS),
            password hashing (bcrypt), database-level access controls (Row Level
            Security), and regular security reviews.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">
            9. Data Processing Agreement
          </h2>
          <p className="text-gray-600 mb-4">
            Restaurants using OrderFlow act as data controllers for their
            customer data. We provide a Data Processing Agreement (DPA) to all
            restaurant partners, available upon request at
            privacy@orderflow.co.uk.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact</h2>
          <p className="text-gray-600 mb-4">
            For privacy enquiries, contact our Data Protection Officer at
            privacy@orderflow.co.uk. You also have the right to lodge a
            complaint with the Information Commissioner&apos;s Office (ICO) at
            ico.org.uk.
          </p>
        </div>
      </main>
    </div>
  );
}
