import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { enviarLembretesVencidos } from "@/lib/agenda/lembretes";

export const maxDuration = 60;

/**
 * Lembretes de compromissos. Chamado a cada 5 min pelo GitHub Actions
 * (.github/workflows/lembretes.yml) - a Vercel Hobby so permite cron diario.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json(await enviarLembretesVencidos());
  } catch (error) {
    console.error("Erro nos lembretes:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Falha nos lembretes" }, { status: 500 });
  }
}
