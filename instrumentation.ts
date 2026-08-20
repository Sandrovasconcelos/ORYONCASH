import * as Sentry from "@sentry/nextjs";

/**
 * So ativa de verdade quando SENTRY_DSN estiver configurada (crie uma
 * conta gratuita em sentry.io, um projeto Next.js, e cole o DSN nas env
 * vars da Vercel). Sem DSN o SDK fica inerte - nao falha, nao manda nada.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
