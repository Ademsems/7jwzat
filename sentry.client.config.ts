import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://582863978bdefdb7dc9c7659763c8ef5@o4511766980657152.ingest.de.sentry.io/4511766987669584",

  // Adds request headers and IP for users, for Sentry user feedback widget
  sendDefaultPii: true,

  // Replay session on error
  replaysOnErrorSampleRate: 1.0,

  // Sample 10% of sessions for replay
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration(),
  ],
});
