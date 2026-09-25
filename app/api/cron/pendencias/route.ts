import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { numeroNotificacao, enviarNotificacao } from "@/lib/alertas/notificar";
import {
  buscarDespesasSemComprovante,
  formatarAvisoSemComprovante,
  tecladoSemComprovante,
} from "@/lib/alertas/pendencias";

/** Lembrete de dias uteis: lancamentos ainda sem comprovante de pagamento. */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const numero = await numeroNotificacao();
    if (!numero) return NextResponse.json({ enviado: false, motivo: "Nenhum número configurado." });

    const itens = await buscarDespesasSemComprovante();
    if (itens.length === 0) return NextResponse.json({ enviado: false, motivo: "Nada pendente." });

    await enviarNotificacao(numero, formatarAvisoSemComprovante(itens), {
      botoes: tecladoSemComprovante(itens),
    });
    return NextResponse.json({ enviado: true, pendentes: itens.length });
  } catch (error) {
    console.error("Erro ao enviar lembrete de comprovantes:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Falha ao enviar lembrete" }, { status: 500 });
  }
}
