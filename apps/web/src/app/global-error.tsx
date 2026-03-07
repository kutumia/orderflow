"use client";

import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 font-sans">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-500 mb-6">
              An unexpected error occurred. Our team has been notified.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="bg-brand-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 inline-flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <a
                href="/"
                className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
