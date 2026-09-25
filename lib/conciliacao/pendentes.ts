import { createAdminClient } from "@/lib/supabase/admin";

export type PendentesDoExtrato = { quantidade: number; total: number };

/**
 * Pagamentos que sairam da conta (debitos) e ainda nao tem lancamento no app
 * nem foram descartados - o numero que importa na conciliacao. Vazio se as
 * tabelas de conciliacao ainda nao existirem.
 */
export async function pendentesPorExtrato(): Promise<Map<string, PendentesDoExtrato>> {
  const mapa = new Map<string, PendentesDoExtrato>();
  const { data, error } = await createAdminClient()
    .from("extrato_transacoes")
    .select("extrato_id, valor")
    .eq("status", "pendente")
    .eq("tipo", "debito")
    .limit(5000);
  if (error) return mapa;
  for (const t of data ?? []) {
    const atual = mapa.get(t.extrato_id) ?? { quantidade: 0, total: 0 };
    atual.quantidade++;
    atual.total += t.valor;
    mapa.set(t.extrato_id, atual);
  }
  return mapa;
}

export async function resumoPendentes(): Promise<PendentesDoExtrato> {
  const total: PendentesDoExtrato = { quantidade: 0, total: 0 };
  for (const p of (await pendentesPorExtrato()).values()) {
    total.quantidade += p.quantidade;
    total.total += p.total;
  }
  return total;
}
