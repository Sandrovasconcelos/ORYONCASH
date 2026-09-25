import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { monitorarSaude } from "@/lib/saude/monitorar";
import { retomarLeiturasPendentes } from "@/lib/gemini/leiturasPendentes";

// Checagens em paralelo (o Gemini pode levar ate ~25s).
export const maxDuration = 60;

/**
 * Monitor de saude dos canais. Chamado a cada 30 min pelo GitHub Actions
 * (.github/workflows/saude.yml) e uma vez por dia pela Vercel como reserva.
 * Tambem retoma cadeias de leitura de documento que ficaram paradas.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const leiturasRetomadas = await retomarLeiturasPendentes().catch(() => 0);
    const { resultados, avisou } = await monitorarSaude();
    return NextResponse.json({
      avisou,
      leiturasRetomadas,
      canais: resultados.map((r) => ({ canal: r.canal, ok: r.ok, detalhe: r.detalhe })),
    });
  } catch (error) {
    console.error("Erro no monitor de saude:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Falha no monitor" }, { status: 500 });
  }
}
