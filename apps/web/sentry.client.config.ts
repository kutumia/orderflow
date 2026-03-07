import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Sample 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Capture 100% of errors
  replaysOnErrorSampleRate: 1.0,

  // Sample 10% of sessions for replays
  replaysSessionSampleRate: 0.1,

  // Don't send PII to Sentry
  sendDefaultPii: false,
});
