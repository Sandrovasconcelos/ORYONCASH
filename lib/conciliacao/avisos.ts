import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { botaoDashboard, type Teclado } from "@/lib/telegram/interativo";
import { nomeDoBeneficiario } from "./classificar";
import { sugerirLancamentos, type SugestaoLancamento } from "./sugestoes";

const MAX_BOTOES = 8;

type Pendente = { id: string; data: string; descricao: string | null; valor: number };

function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

async function listarPendentes(): Promise<Pendente[]> {
  const { data, error } = await createAdminClient()
    .from("extrato_transacoes")
    .select("id, data, descricao, valor")
    .eq("status", "pendente")
    .eq("tipo", "debito")
    .order("valor", { ascending: false })
    .limit(2000);
  return error ? [] : (data ?? []);
}

/**
 * Aviso de pagamentos que sairam da conta sem lancamento no app, com um botao
 * por pagamento (os de maior valor primeiro). Null se nao houver pendencia.
 */
export async function avisoPagamentosSemLancamento(): Promise<{ mensagem: string; botoes: Teclado } | null> {
  const pendentes = await listarPendentes();
  if (pendentes.length === 0) return null;

  const total = pendentes.reduce((soma, p) => soma + p.valor, 0);
  const botoes: Teclado = pendentes.slice(0, MAX_BOTOES).map((p) => {
    const quem = nomeDoBeneficiario(p.descricao) ?? p.descricao ?? "Pagamento";
    return [{ text: `${formatBRL(p.valor)} · ${quem} · ${dataCurta(p.data)}`.slice(0, 60), callback_data: `xp:${p.id}` }];
  });
  botoes.push([botaoDashboard("/conciliacao", "🏦 Abrir conciliação")]);

  const resto = pendentes.length - Math.min(pendentes.length, MAX_BOTOES);
  const mensagem = [
    "🏦 *OryonCash* — Pagamentos sem lançamento",
    "",
    `${pendentes.length} pagamento(s) saíram da conta e não estão no app (${formatBRL(total)} no total).`,
    "Toque num pagamento pra lançar ou descartar:",
    ...(resto > 0 ? ["", `… e mais ${resto} na conciliação do dashboard.`] : []),
  ].join("\n");
  return { mensagem, botoes };
}

/** Cartao de um pagamento, com as acoes possiveis. */
export function cartaoDoPagamento(
  p: Pendente,
  sugestao: SugestaoLancamento | undefined
): { mensagem: string; botoes: Teclado } {
  const linhas = [
    "🏦 *Pagamento sem lançamento*",
    `💰 *Valor:* ${formatBRL(p.valor)}`,
    `📅 *Data:* ${dataCurta(p.data)}`,
    `🧾 *No extrato:* ${p.descricao ?? "—"}`,
  ];
  if (sugestao) {
    linhas.push(
      "",
      `💡 Parece ser *${sugestao.fornecedorNome}*` +
        (sugestao.origem === "regra" ? " (como você lançou da última vez)." : ".")
    );
  }
  const quem = nomeDoBeneficiario(p.descricao);
  return {
    mensagem: linhas.join("\n"),
    botoes: [
      [{ text: "✅ Lançar", callback_data: `xl:${p.id}` }],
      [
        { text: "🙈 Ignorar só este", callback_data: `xi:${p.id}` },
        { text: quem ? "🙈 Ignorar sempre" : "🙈 Ignorar sempre este tipo", callback_data: `xs:${p.id}` },
      ],
    ],
  };
}

export async function cartaoPorId(id: string) {
  const { data } = await createAdminClient()
    .from("extrato_transacoes")
    .select("id, data, descricao, valor, status, tipo")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.status !== "pendente" || data.tipo !== "debito") return null;
  const sugestao = (await sugerirLancamentos([data]).catch(() => new Map())).get(data.id);
  return cartaoDoPagamento(data, sugestao);
}
