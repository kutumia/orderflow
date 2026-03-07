import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  // Filter out noisy errors
  beforeSend(event) {
    // Don't send 404 errors
    if (event.exception?.values?.[0]?.value?.includes("NEXT_NOT_FOUND")) {
      return null;
    }
    return event;
  },
});
