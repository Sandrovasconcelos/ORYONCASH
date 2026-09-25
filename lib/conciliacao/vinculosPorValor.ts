import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { registrarAtividade } from "@/lib/atividades";
import { vincularTransacaoADespesa } from "./queries";

/** Lancamentos feitos dias depois do pagamento (nao deu pra lancar no dia). */
const JANELA_DIAS = 45;

export type VinculoPorValor = {
  transacaoId: string;
  despesaId: string;
  despesaData: string;
  despesaValor: number;
  despesaDescricao: string | null;
  transacaoData: string;
  dias: number;
};

function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

const centavos = (v: number) => Math.round(v * 100);

/**
 * Pra debitos ainda sem lancamento, acha lancamentos de MESMO valor (ao
 * centavo) com data diferente - o caso de quem lanca o pagamento dias depois.
 * So sugere quando o par e inequivoco nos dois sentidos: a transacao tem um
 * unico candidato e o lancamento so serve pra essa transacao. Nunca vincula
 * sozinho: o usuario aceita (e a data do lancamento passa a ser a do banco).
 */
export async function buscarVinculosPorValor(
  transacoes: { id: string; data: string; valor: number }[]
): Promise<Map<string, VinculoPorValor>> {
  const resultado = new Map<string, VinculoPorValor>();
  if (transacoes.length === 0) return resultado;

  const supabase = createAdminClient();
  const datas = transacoes.map((t) => t.data).sort();
  const dia = (iso: string, delta: number) =>
    new Date(Date.parse(`${iso}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);

  const [{ data: despesas }, { data: vinculadas }] = await Promise.all([
    supabase
      .from("despesas")
      .select("id, data, valor, descricao")
      .is("deleted_at", null)
      .gte("data", dia(datas[0], -JANELA_DIAS))
      .lte("data", dia(datas[datas.length - 1], JANELA_DIAS))
      .limit(5000),
    supabase.from("extrato_transacoes").select("despesa_id").not("despesa_id", "is", null),
  ]);
  const usadas = new Set((vinculadas ?? []).map((v) => v.despesa_id));
  const livres = (despesas ?? []).filter((d) => !usadas.has(d.id));

  const candidatosDaTransacao = new Map<string, typeof livres>();
  const transacoesDaDespesa = new Map<string, string[]>();
  for (const t of transacoes) {
    // Valores pequenos repetem demais (R$ 20, R$ 50): so sugere de R$ 100 pra cima.
    if (t.valor < 100) continue;
    const candidatos = livres.filter(
      (d) => centavos(d.valor) === centavos(t.valor) && Math.abs(diffDias(d.data, t.data)) <= JANELA_DIAS
    );
    candidatosDaTransacao.set(t.id, candidatos);
    for (const d of candidatos) transacoesDaDespesa.set(d.id, [...(transacoesDaDespesa.get(d.id) ?? []), t.id]);
  }

  for (const t of transacoes) {
    const candidatos = candidatosDaTransacao.get(t.id) ?? [];
    if (candidatos.length !== 1) continue;
    const d = candidatos[0];
    if ((transacoesDaDespesa.get(d.id) ?? []).length !== 1) continue;
    resultado.set(t.id, {
      transacaoId: t.id,
      despesaId: d.id,
      despesaData: d.data,
      despesaValor: d.valor,
      despesaDescricao: d.descricao,
      transacaoData: t.data,
      dias: diffDias(d.data, t.data),
    });
  }
  return resultado;
}

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/**
 * Aceita a sugestao: liga o pagamento ao lancamento e, se pedido, acerta a
 * data do lancamento pra data real do pagamento no banco.
 */
export async function aceitarVinculoPorValor(input: {
  transacaoId: string;
  despesaId: string;
  ajustarData: boolean;
  autorNome: string;
  autorTelefone?: string | null;
  origem: "dashboard" | "whatsapp";
}): Promise<{ ok: boolean; dataAntiga?: string; dataNova?: string; valor?: number }> {
  const supabase = createAdminClient();
  const [{ data: transacao }, { data: despesa }] = await Promise.all([
    supabase.from("extrato_transacoes").select("id, data, valor, status").eq("id", input.transacaoId).maybeSingle(),
    supabase.from("despesas").select("id, data, valor, deleted_at").eq("id", input.despesaId).maybeSingle(),
  ]);
  if (!transacao || transacao.status !== "pendente" || !despesa || despesa.deleted_at) return { ok: false };

  if (input.ajustarData && despesa.data !== transacao.data) {
    const { error } = await supabase.from("despesas").update({ data: transacao.data }).eq("id", despesa.id);
    if (error) throw error;
    await registrarAtividade({
      tipo: "edicao",
      entidade: "despesa",
      entidadeId: despesa.id,
      origem: input.origem,
      autorTelefone: input.autorTelefone ?? null,
      autorNome: input.autorNome,
      resumo: `Data do lançamento de ${formatBRL(despesa.valor)} corrigida de ${dataBR(despesa.data)} para ${dataBR(transacao.data)} (data do pagamento no extrato) por ${input.autorNome}`,
      dadosAntes: { data: despesa.data },
      dadosDepois: { data: transacao.data },
    });
  }

  await vincularTransacaoADespesa(transacao.id, despesa.id);
  return {
    ok: true,
    dataAntiga: despesa.data,
    dataNova: input.ajustarData ? transacao.data : despesa.data,
    valor: despesa.valor,
  };
}
