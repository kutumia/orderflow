"use client";

import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="h-12 w-12 bg-danger-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-danger-500" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Page Error</h2>
        <p className="text-sm text-gray-500 mb-4">
          Something went wrong loading this page.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary text-sm inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
          <a href="/dashboard" className="btn-secondary text-sm inline-flex items-center gap-2">
            <Home className="h-4 w-4" /> Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
