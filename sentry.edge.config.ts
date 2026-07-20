import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://582863978bdefdb7dc9c7659763c8ef5@o4511766980657152.ingest.de.sentry.io/4511766987669584",

  sendDefaultPii: true,
});
