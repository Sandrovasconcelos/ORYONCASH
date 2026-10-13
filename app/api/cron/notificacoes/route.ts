import { NextRequest, NextResponse } from "next/server";
import { enviarNotificacaoDiaria } from "@/lib/alertas/notificar";
import { retomarLeiturasPendentes } from "@/lib/gemini/leiturasPendentes";
import { enviarAgendaDoDia } from "@/lib/agenda/lembretes";
import { enviarAvisosDeValidade } from "@/lib/arquivos/avisos";

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
  // Agenda pessoal do dia (cada pessoa recebe a sua). Nunca derruba o aviso diario.
  const agenda = await enviarAgendaDoDia().catch((error) => {
    console.error("Falha ao enviar a agenda do dia:", error);
    return { pessoas: 0 };
  });
  // Documentos que vencem (certidoes, alvaras, licitacoes). Nunca derruba o aviso diario.
  const documentos = await enviarAvisosDeValidade().catch((error) => {
    console.error("Falha ao avisar vencimento de documentos:", error);
    return { avisados: 0 };
  });
  return NextResponse.json({ ...resultado, leiturasRetomadas, agenda, documentos });
}
