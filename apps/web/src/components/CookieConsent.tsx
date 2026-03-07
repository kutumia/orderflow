"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("orderflow_cookie_consent");
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("orderflow_cookie_consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("orderflow_cookie_consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            We use essential cookies to keep you logged in and optional analytics
            cookies to improve our service. See our{" "}
            <a href="/privacy" className="text-brand-600 underline">
              Privacy Policy
            </a>{" "}
            for details.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={decline} className="btn-secondary text-sm px-4 py-2">
            Decline
          </button>
          <button onClick={accept} className="btn-primary text-sm px-4 py-2">
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
