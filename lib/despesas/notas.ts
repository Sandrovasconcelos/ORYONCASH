import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Uma nota com varios itens vira varias despesas (uma por item), todas ligadas
 * ao MESMO arquivo em despesa_comprovantes. O banco, porem, mostra um unico
 * pagamento com o total da nota - entao pra conciliar (e pra explicar a tela)
 * o app precisa enxergar o grupo inteiro: mesmo arquivo = mesma nota.
 */

export type GrupoNota = {
  chave: string;
  /** Todos os itens (despesas ativas) da nota, em ordem estavel. */
  membros: string[];
  total: number;
  /** Data do item mais antigo do grupo. */
  data: string;
};

const LOTE = 120;

function emLotes<T>(itens: T[]): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += LOTE) lotes.push(itens.slice(i, i + LOTE));
  return lotes;
}

type LinhaComprovante = {
  despesa_id: string | null;
  tipo_documento: string;
  storage_bucket: string;
  storage_path: string;
};

/**
 * Pra cada despesa que pertence a uma nota com 2+ itens, devolve o grupo
 * (chave = arquivo compartilhado). Despesas sem grupo nao aparecem no mapa.
 */
export async function carregarNotas(despesaIds: string[]): Promise<Map<string, GrupoNota>> {
  const resultado = new Map<string, GrupoNota>();
  if (despesaIds.length === 0) return resultado;
  const supabase = createAdminClient();

  // 1) arquivo de cada despesa: a nota (cobranca) vale mais que o comprovante de pagamento.
  const doMeuArquivo = new Map<string, string>();
  for (const lote of emLotes(despesaIds)) {
    const { data, error } = await supabase
      .from("despesa_comprovantes")
      .select("despesa_id, tipo_documento, storage_bucket, storage_path")
      .in("despesa_id", lote);
    if (error) return resultado;
    const porDespesa = new Map<string, LinhaComprovante[]>();
    for (const c of (data ?? []) as LinhaComprovante[]) {
      if (!c.despesa_id) continue;
      porDespesa.set(c.despesa_id, [...(porDespesa.get(c.despesa_id) ?? []), c]);
    }
    for (const [id, linhas] of porDespesa) {
      const escolhida =
        linhas.find((l) => l.tipo_documento === "documento_cobranca") ??
        linhas.find((l) => l.tipo_documento === "comprovante_pagamento");
      if (escolhida) doMeuArquivo.set(id, `${escolhida.storage_bucket}/${escolhida.storage_path}`);
    }
  }
  if (doMeuArquivo.size === 0) return resultado;

  // 2) todos os itens que dividem esses arquivos (mesmo fora da lista original).
  const caminhos = [...new Set([...doMeuArquivo.values()].map((c) => c.slice(c.indexOf("/") + 1)))];
  const membrosPorChave = new Map<string, Set<string>>();
  for (const lote of emLotes(caminhos)) {
    const { data } = await supabase
      .from("despesa_comprovantes")
      .select("despesa_id, storage_bucket, storage_path")
      .in("storage_path", lote);
    for (const c of data ?? []) {
      if (!c.despesa_id) continue;
      const chave = `${c.storage_bucket}/${c.storage_path}`;
      const conjunto = membrosPorChave.get(chave) ?? new Set<string>();
      conjunto.add(c.despesa_id);
      membrosPorChave.set(chave, conjunto);
    }
  }

  // 3) so itens ativos contam; valor e data vem das despesas.
  const todosIds = [...new Set([...membrosPorChave.values()].flatMap((s) => [...s]))];
  const despesas = new Map<string, { valor: number; data: string }>();
  for (const lote of emLotes(todosIds)) {
    const { data } = await supabase.from("despesas").select("id, valor, data").in("id", lote).is("deleted_at", null);
    for (const d of data ?? []) despesas.set(d.id, { valor: d.valor, data: d.data });
  }

  const grupos = new Map<string, GrupoNota>();
  for (const [chave, conjunto] of membrosPorChave) {
    const membros = [...conjunto].filter((id) => despesas.has(id)).sort();
    if (membros.length < 2) continue;
    const total = Math.round(membros.reduce((s, id) => s + despesas.get(id)!.valor, 0) * 100) / 100;
    const data = membros.map((id) => despesas.get(id)!.data).sort()[0];
    grupos.set(chave, { chave, membros, total, data });
  }

  for (const [id, chave] of doMeuArquivo) {
    const grupo = grupos.get(chave);
    if (grupo && grupo.membros.includes(id)) resultado.set(id, grupo);
  }
  return resultado;
}

export type CandidataColapsada = {
  /** Despesa avulsa: o proprio id. Nota: id do primeiro item (representante). */
  id: string;
  data: string;
  valor: number;
  descricao: string | null;
  membros: string[];
};

/**
 * Troca os itens de uma mesma nota por UMA candidata com o valor somado -
 * e o que o banco enxerga como um pagamento so.
 */
export async function colapsarNotas(
  despesas: { id: string; data: string; valor: number; descricao?: string | null }[]
): Promise<CandidataColapsada[]> {
  const notas = await carregarNotas(despesas.map((d) => d.id));
  const emitidos = new Set<string>();
  const saida: CandidataColapsada[] = [];

  for (const d of despesas) {
    const grupo = notas.get(d.id);
    if (!grupo) {
      saida.push({ id: d.id, data: d.data, valor: d.valor, descricao: d.descricao ?? null, membros: [d.id] });
      continue;
    }
    if (emitidos.has(grupo.chave)) continue;
    emitidos.add(grupo.chave);
    saida.push({
      id: grupo.membros[0],
      data: grupo.data,
      valor: grupo.total,
      descricao: `Nota com ${grupo.membros.length} itens`,
      membros: grupo.membros,
    });
  }
  return saida;
}

/** Ids ja ligados a uma transacao + todos os itens das notas a que pertencem. */
export async function expandirParaNota(ids: string[]): Promise<Set<string>> {
  const todos = new Set(ids);
  const notas = await carregarNotas(ids);
  for (const grupo of notas.values()) for (const m of grupo.membros) todos.add(m);
  return todos;
}
