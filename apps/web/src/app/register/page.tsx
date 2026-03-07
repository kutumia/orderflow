"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Utensils, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { generateSlug } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    restaurantName: "",
    ownerName: "",
    email: "",
    password: "",
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slug = generateSlug(form.restaurantName);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.restaurantName.trim()) {
      setError("Restaurant name is required");
      return;
    }
    if (!form.ownerName.trim()) {
      setError("Your name is required");
      return;
    }
    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!form.acceptTerms) {
      setError("You must accept the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);

    try {
      // Register
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantName: form.restaurantName.trim(),
          ownerName: form.ownerName.trim(),
          email: form.email.toLowerCase().trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto sign-in after registration
      const signInResult = await signIn("credentials", {
        email: form.email.toLowerCase().trim(),
        password: form.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Account created but sign-in failed. Please log in manually.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-700 text-white p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-16">
            <Utensils className="h-8 w-8" />
            <span className="text-2xl font-bold">OrderFlow</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-6">
            Stop paying delivery apps 30% forever.
          </h1>
          <p className="text-brand-200 text-lg leading-relaxed">
            Get your own branded ordering website, automatic kitchen printing,
            and a powerful dashboard — in minutes. 14-day free trial, no card
            required.
          </p>
        </div>
        <div className="text-brand-300 text-sm">
          © 2026 OrderFlow. Built for UK restaurants.
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Utensils className="h-7 w-7 text-brand-600" />
            <span className="text-xl font-bold">OrderFlow</span>
          </div>

          <h2 className="text-2xl font-bold mb-2">Create your account</h2>
          <p className="text-gray-500 mb-8">
            Start your 14-day free trial. No card required.
          </p>

          {error && (
            <div className="bg-danger-50 text-danger-500 text-sm px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Restaurant Name */}
            <div>
              <label htmlFor="restaurantName" className="label">
                Restaurant Name
              </label>
              <input
                id="restaurantName"
                name="restaurantName"
                type="text"
                className="input-field"
                placeholder="Mario's Pizza & Pasta"
                value={form.restaurantName}
                onChange={handleChange}
                disabled={loading}
              />
              {slug && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Your ordering page:{" "}
                  <span className="text-brand-600 font-medium">
                    orderflow.co.uk/{slug}
                  </span>
                </p>
              )}
            </div>

            {/* Owner Name */}
            <div>
              <label htmlFor="ownerName" className="label">
                Your Name
              </label>
              <input
                id="ownerName"
                name="ownerName"
                type="text"
                className="input-field"
                placeholder="Mario Rossi"
                value={form.ownerName}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="input-field"
                placeholder="mario@mariospizza.co.uk"
                value={form.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-10"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3 pt-2">
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                checked={form.acceptTerms}
                onChange={handleChange}
                disabled={loading}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="acceptTerms" className="text-sm text-gray-600">
                I agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-brand-600 underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-brand-600 underline"
                >
                  Privacy Policy
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-600 font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
