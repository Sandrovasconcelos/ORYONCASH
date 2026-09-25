import { NextRequest, NextResponse } from "next/server";
import { enviarNotificacaoDiaria } from "@/lib/alertas/notificar";
import { retomarLeiturasPendentes } from "@/lib/gemini/leiturasPendentes";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Varredura de seguranca: retoma leituras de documento cuja cadeia de
  // tentativas foi interrompida (deploy/queda). Nunca derruba o aviso diario.
  const leiturasRetomadas = await retomarLeiturasPendentes().catch((error) => {
    console.error("Falha ao retomar leituras pendentes:", error);
    return 0;
  });

  const resultado = await enviarNotificacaoDiaria();
  return NextResponse.json({ ...resultado, leiturasRetomadas });
}
