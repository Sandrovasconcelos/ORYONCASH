import * as Sentry from "@sentry/nextjs";
import { desfazerDespesaRecente } from "@/lib/conversation/queries";
import { formatBRL } from "@/lib/conversation/format";
import { getNomePorTelefone, registrarAtividade } from "@/lib/atividades";
import { marcarContaAPagarComoPaga } from "@/lib/contasAPagar/queries";
import { buscarTransacaoPendente, ignorarTransacao } from "@/lib/conciliacao/queries";
import { aplicarRegrasDeIgnorar, salvarRegra } from "@/lib/conciliacao/regras";
import { aceitarVinculoPorValor, buscarVinculosPorValor } from "@/lib/conciliacao/vinculosPorValor";

/**
 * Logica das acoes dos botoes dos avisos (desfazer, paguei, lancar/ignorar/
 * vincular pagamento do extrato). Fica aqui, sem nada de Telegram nem de
 * WhatsApp, pra os dois canais usarem a mesma regra: cada um so decide como
 * mostrar o resultado (toast + editar mensagem no Telegram; texto no WhatsApp).
 */

/** Prefixos de callback das acoes de botao. */
export const PADRAO_ACAO_DE_BOTAO = /^(cp|dz|cr|ap|xp|xl|xi|xs|xv):/;

export type StatusDesfazer = "desfeita" | "expirou" | "nao_encontrada" | "erro";

export async function desfazerLancamentoPorBotao(
  from: string,
  despesaId: string
): Promise<{ status: StatusDesfazer; texto: string; autorNome: string }> {
  const autorNome = await getNomePorTelefone(from).catch(() => "Alguém");
  const r = await desfazerDespesaRecente(despesaId, autorNome).catch((error) => {
    console.error("Falha ao desfazer lançamento pelo botão:", error);
    Sentry.captureException(error);
    return null;
  });

  if (!r) {
    return { status: "erro", autorNome, texto: "Não consegui desfazer agora. Tente de novo ou use Corrigir → Excluir." };
  }
  if (r.resultado === "expirou") {
    return { status: "expirou", autorNome, texto: "Já passaram mais de 15 minutos. Use Corrigir → Excluir para apagar." };
  }
  if (r.resultado === "nao_encontrada") {
    return { status: "nao_encontrada", autorNome, texto: "Esse lançamento já foi excluído." };
  }

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "despesa",
    entidadeId: despesaId,
    origem: "whatsapp",
    autorTelefone: from,
    autorNome,
    resumo: `Lançamento de ${formatBRL(r.valor ?? 0)} desfeito por ${autorNome} (botão do aviso)`,
  }).catch(() => {});
  return { status: "desfeita", autorNome, texto: "↩️ Lançamento desfeito." };
}

export async function pagarContaPorBotao(from: string, contaId: string): Promise<{ ok: boolean; texto: string }> {
  const autorNome = await getNomePorTelefone(from).catch(() => "Alguém");
  const resultado = await marcarContaAPagarComoPaga({ contaId, autorTelefone: from, autorNome }).catch((error) => {
    console.error("Falha ao marcar conta como paga pelo botão:", error);
    return null;
  });
  return resultado
    ? { ok: true, texto: "✅ Conta marcada como paga e lançada nas despesas." }
    : { ok: false, texto: "Essa conta já estava paga (ou não foi encontrada)." };
}

export type AcaoDePagamento = "xl" | "xi" | "xs" | "xv";

/**
 * Acoes do cartao de um pagamento do extrato sem lancamento.
 * "xl" (lancar) so valida - quem chama abre o fluxo de lancamento.
 */
export async function resolverPagamentoPorBotao(
  from: string,
  acao: AcaoDePagamento,
  transacaoId: string
): Promise<{ status: "ja_resolvido" | "ok" | "falha"; texto: string }> {
  const transacao = await buscarTransacaoPendente(transacaoId);
  if (!transacao) return { status: "ja_resolvido", texto: "Esse pagamento já foi resolvido." };

  if (acao === "xi") {
    await ignorarTransacao(transacaoId);
    return { status: "ok", texto: "🙈 Ignorado." };
  }

  if (acao === "xs") {
    await salvarRegra({ descricao: transacao.descricao, acao: "ignorar" });
    await ignorarTransacao(transacaoId);
    await aplicarRegrasDeIgnorar(transacao.extrato_id).catch(() => 0);
    return { status: "ok", texto: "🙈 Ignorado — nos próximos extratos também." };
  }

  if (acao === "xv") {
    const vinculo = (await buscarVinculosPorValor([transacao])).get(transacao.id);
    const autorNome = await getNomePorTelefone(from).catch(() => "Alguém");
    const r = vinculo
      ? await aceitarVinculoPorValor({
          transacaoId,
          despesaId: vinculo.despesaId,
          ajustarData: true,
          autorNome,
          autorTelefone: from,
          origem: "whatsapp",
        }).catch(() => ({ ok: false }))
      : { ok: false };
    return r.ok
      ? {
          status: "ok",
          texto: `🔗 Vinculado. A data do lançamento agora é ${transacao.data.split("-").reverse().slice(0, 2).join("/")}.`,
        }
      : { status: "falha", texto: "Não achei mais o lançamento certo pra vincular. Use Lançar ou resolva no dashboard." };
  }

  return { status: "ok", texto: "➡️ Vamos lançar (siga as perguntas abaixo)." };
}
