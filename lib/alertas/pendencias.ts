import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { botaoDashboard, type Teclado } from "@/lib/telegram/interativo";

export type DespesaSemComprovante = {
  id: string;
  valor: number;
  descricao: string | null;
  data: string;
  obraNome: string | null;
};

const DIAS_ATRAS_MAX = 30;
const MAX_NO_AVISO = 6;

/**
 * Lancamentos dos ultimos 30 dias (a partir de ontem, pra dar tempo de anexar)
 * que ainda nao tem comprovante de pagamento vinculado.
 */
export async function buscarDespesasSemComprovante(): Promise<DespesaSemComprovante[]> {
  const supabase = createAdminClient();
  const agora = Date.now();
  const desde = new Date(agora - DIAS_ATRAS_MAX * 24 * 60 * 60 * 1000).toISOString();
  const ate = new Date(agora - 24 * 60 * 60 * 1000).toISOString();

  const { data: despesas, error } = await supabase
    .from("despesas")
    .select("id, valor, descricao, data, obras(nome)")
    .is("deleted_at", null)
    .gte("created_at", desde)
    .lte("created_at", ate)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error || !despesas || despesas.length === 0) return [];

  const { data: comprovantes, error: erroComprovantes } = await supabase
    .from("despesa_comprovantes")
    .select("despesa_id")
    .eq("tipo_documento", "comprovante_pagamento")
    .in(
      "despesa_id",
      despesas.map((d) => d.id)
    );
  // Sem a tabela nao da pra saber o que falta - melhor nao avisar do que avisar tudo.
  if (erroComprovantes) return [];

  const comProva = new Set((comprovantes ?? []).map((c) => c.despesa_id));
  return despesas
    .filter((d) => !comProva.has(d.id))
    .map((d) => ({
      id: d.id,
      valor: d.valor,
      descricao: d.descricao,
      data: d.data,
      obraNome: (d.obras as unknown as { nome: string } | null)?.nome ?? null,
    }));
}

function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function formatarAvisoSemComprovante(itens: DespesaSemComprovante[]): string {
  const linhas = itens.slice(0, MAX_NO_AVISO).map((d) => {
    const desc = d.descricao ? ` — ${d.descricao}` : "";
    const obra = d.obraNome ? ` (${d.obraNome})` : "";
    return `• ${dataCurta(d.data)} ${formatBRL(d.valor)}${desc}${obra}`;
  });
  const resto = itens.length - linhas.length;
  return [
    `📎 *OryonCash* — Lançamentos sem comprovante de pagamento`,
    "",
    ...linhas,
    ...(resto > 0 ? [`… e mais ${resto} no dashboard.`] : []),
    "",
    "Toque num botão abaixo e envie o comprovante.",
  ].join("\n");
}

export function tecladoSemComprovante(itens: DespesaSemComprovante[]): Teclado {
  const linhas: Teclado = itens.slice(0, MAX_NO_AVISO).map((d) => {
    const nome = d.descricao ? d.descricao.slice(0, 24) : dataCurta(d.data);
    return [{ text: `📎 ${formatBRL(d.valor)} · ${nome}`.slice(0, 60), callback_data: `ap:${d.id}` }];
  });
  linhas.push([botaoDashboard("/despesas", "🧾 Ver lançamentos")]);
  return linhas;
}
