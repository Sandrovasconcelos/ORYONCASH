import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { numeroNotificacao, enviarNotificacao } from "@/lib/alertas/notificar";
import { resumoPendentes } from "@/lib/conciliacao/pendentes";
import { reconciliarTodosOsExtratos } from "@/lib/conciliacao/queries";
import { formatBRL } from "@/lib/conversation/format";
import { botaoDashboard } from "@/lib/telegram/interativo";
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

    const [itens, extrato] = await Promise.all([buscarDespesasSemComprovante(), resumoPendentes()]);
    if (itens.length === 0 && extrato.quantidade === 0) {
      return NextResponse.json({ enviado: false, motivo: "Nada pendente." });
    }

    let mensagem = itens.length > 0 ? formatarAvisoSemComprovante(itens) : "📋 *OryonCash* — Pendências";
    let botoes = itens.length > 0 ? tecladoSemComprovante(itens) : [[botaoDashboard("/conciliacao", "🏦 Abrir conciliação")]];
    if (extrato.quantidade > 0) {
      mensagem += `\n\n🏦 *Extrato bancário:* ${extrato.quantidade} pagamento(s) (${formatBRL(extrato.total)}) saíram da conta e não têm lançamento no app.`;
      if (itens.length > 0) botoes = [...botoes, [botaoDashboard("/conciliacao", "🏦 Abrir conciliação")]];
    }

    await enviarNotificacao(numero, mensagem, { botoes });
    return NextResponse.json({ enviado: true, pendentes: itens.length, extratoPendentes: extrato.quantidade });
  } catch (error) {
    console.error("Erro ao enviar lembrete de comprovantes:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Falha ao enviar lembrete" }, { status: 500 });
  }
}
