"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "./ToastProvider";
import { ErrorBoundary } from "./ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ErrorBoundary>
        <ToastProvider>{children}</ToastProvider>
      </ErrorBoundary>
    </SessionProvider>
  );
}
