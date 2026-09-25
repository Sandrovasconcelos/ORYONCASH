import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { numeroNotificacao, enviarNotificacao } from "@/lib/alertas/notificar";
import { avisoPagamentosSemLancamento } from "@/lib/conciliacao/avisos";
import { reconciliarTodosOsExtratos } from "@/lib/conciliacao/queries";
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

    // Lancamentos feitos depois do upload do extrato passam a contar como pagos.
    await reconciliarTodosOsExtratos().catch(() => 0);

    const [itens, avisoExtrato] = await Promise.all([buscarDespesasSemComprovante(), avisoPagamentosSemLancamento()]);
    if (itens.length === 0 && !avisoExtrato) {
      return NextResponse.json({ enviado: false, motivo: "Nada pendente." });
    }

    if (itens.length > 0) {
      await enviarNotificacao(numero, formatarAvisoSemComprovante(itens), { botoes: tecladoSemComprovante(itens) });
    }
    // Mensagem separada: cada pagamento do extrato vira um botao (lancar/ignorar).
    if (avisoExtrato) {
      await enviarNotificacao(numero, avisoExtrato.mensagem, { botoes: avisoExtrato.botoes });
    }
    return NextResponse.json({ enviado: true, semComprovante: itens.length, extratoPendente: Boolean(avisoExtrato) });
  } catch (error) {
    console.error("Erro ao enviar lembrete de comprovantes:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Falha ao enviar lembrete" }, { status: 500 });
  }
}
