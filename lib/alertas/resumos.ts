import { createAdminClient } from "@/lib/supabase/admin";

export type ResumoPeriodo = {
  total: number;
  porConta: { nome: string; total: number }[];
  porObraEtapa: { obraNome: string; etapaNome: string | null; total: number }[];
};

/**
 * Soma as despesas lancadas entre dataInicio e dataFim (inclusive, formato
 * YYYY-MM-DD), agrupadas por conta bancaria e por obra+etapa. Usada tanto
 * pelo resumo diario (22h) quanto pelo semanal (segunda 7h).
 */
export async function buscarResumoPeriodo(dataInicio: string, dataFim: string): Promise<ResumoPeriodo> {
  const supabase = createAdminClient();

  const [{ data: despesas }, { data: contas }, { data: obras }, { data: etapas }] = await Promise.all([
    supabase
      .from("despesas")
      .select("valor, obra_id, etapa_id, conta_bancaria_id")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .is("deleted_at", null),
    supabase.from("contas_bancarias").select("id, nome").is("deleted_at", null),
    supabase.from("obras").select("id, nome").is("deleted_at", null),
    supabase.from("etapas").select("id, nome").is("deleted_at", null),
  ]);

  const nomesConta = new Map((contas ?? []).map((c) => [c.id, c.nome]));
  const nomesObra = new Map((obras ?? []).map((o) => [o.id, o.nome]));
  const nomesEtapa = new Map((etapas ?? []).map((e) => [e.id, e.nome]));

  const lista = despesas ?? [];
  const total = lista.reduce((soma, d) => soma + Number(d.valor), 0);

  const porContaMap = new Map<string, number>();
  for (const d of lista) {
    const nome = d.conta_bancaria_id ? nomesConta.get(d.conta_bancaria_id) ?? "Conta desconhecida" : "Sem conta vinculada";
    porContaMap.set(nome, (porContaMap.get(nome) ?? 0) + Number(d.valor));
  }

  const porObraEtapaMap = new Map<string, number>();
  for (const d of lista) {
    const obraNome = d.obra_id ? nomesObra.get(d.obra_id) ?? "Obra desconhecida" : "Sem obra";
    const etapaNome = d.etapa_id ? nomesEtapa.get(d.etapa_id) ?? null : null;
    const chave = `${obraNome}::${etapaNome ?? ""}`;
    porObraEtapaMap.set(chave, (porObraEtapaMap.get(chave) ?? 0) + Number(d.valor));
  }

  return {
    total,
    porConta: [...porContaMap.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total),
    porObraEtapa: [...porObraEtapaMap.entries()]
      .map(([chave, total]) => {
        const [obraNome, etapaNome] = chave.split("::");
        return { obraNome, etapaNome: etapaNome || null, total };
      })
      .sort((a, b) => b.total - a.total),
  };
}
