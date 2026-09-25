import { createAdminClient } from "@/lib/supabase/admin";
import { ehMovimentoFinanceiro, nomeDoBeneficiario } from "./classificar";

export type Regra = {
  id: string;
  chave: string;
  acao: "ignorar" | "lancar";
  obra_id: string | null;
  categoria_id: string | null;
  fornecedor_id: string | null;
  exemplo: string | null;
  vezes_usada: number;
};

/**
 * Identifica "pra quem foi" o pagamento, sem acento/caixa: o nome depois do
 * ultimo " - " ("DEB PIX QR COD DIN - Marsol Distribuido" -> "marsol distribuido").
 * Sem nome (ex: "TAR PIX", "TARIFA MANUTENCAO CONTA A"), usa a propria
 * descricao sem digitos - assim tarifas iguais caem na mesma regra.
 */
export function chaveDaTransacao(descricao: string | null | undefined): string | null {
  const base = nomeDoBeneficiario(descricao) ?? (descricao ?? "").replace(/[\d.\-/]+/g, " ");
  const chave = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return chave.length >= 3 ? chave : null;
}

const COLUNAS = "id, chave, acao, obra_id, categoria_id, fornecedor_id, exemplo, vezes_usada";

/** Vazio (sem erro) enquanto a tabela nao existir - tudo segue funcionando sem regras. */
export async function carregarRegras(): Promise<Map<string, Regra>> {
  const { data, error } = await createAdminClient().from("conciliacao_regras").select(COLUNAS);
  if (error || !data) return new Map();
  return new Map((data as Regra[]).map((r) => [r.chave, r]));
}

export async function listarRegras(): Promise<Regra[]> {
  const { data, error } = await createAdminClient()
    .from("conciliacao_regras")
    .select(COLUNAS)
    .order("created_at", { ascending: false });
  return error || !data ? [] : (data as Regra[]);
}

export async function salvarRegra(input: {
  descricao: string | null;
  acao: "ignorar" | "lancar";
  obraId?: string | null;
  categoriaId?: string | null;
  fornecedorId?: string | null;
}): Promise<boolean> {
  const chave = chaveDaTransacao(input.descricao);
  if (!chave) return false;
  const { error } = await createAdminClient()
    .from("conciliacao_regras")
    .upsert(
      {
        chave,
        acao: input.acao,
        obra_id: input.acao === "lancar" ? (input.obraId ?? null) : null,
        categoria_id: input.acao === "lancar" ? (input.categoriaId ?? null) : null,
        fornecedor_id: input.acao === "lancar" ? (input.fornecedorId ?? null) : null,
        exemplo: input.descricao,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chave" }
    );
  if (error) console.warn("Regra de conciliacao nao salva (migration aplicada?):", error.message);
  return !error;
}

export async function apagarRegra(id: string): Promise<void> {
  await createAdminClient().from("conciliacao_regras").delete().eq("id", id);
}

/**
 * Marca como "ignorado" os debitos pendentes de um extrato que sao aplicacao/
 * resgate ou cujo beneficiario tem regra "ignorar". Devolve quantos foram ignorados.
 */
export async function aplicarRegrasDeIgnorar(extratoId: string): Promise<number> {
  const regras = await carregarRegras();
  const ignorar = new Set([...regras.values()].filter((r) => r.acao === "ignorar").map((r) => r.chave));
  const supabase = createAdminClient();
  const { data: pendentes } = await supabase
    .from("extrato_transacoes")
    .select("id, descricao")
    .eq("extrato_id", extratoId)
    .eq("status", "pendente")
    .eq("tipo", "debito");

  const ids = (pendentes ?? [])
    .filter((t) => {
      const chave = chaveDaTransacao(t.descricao);
      return ehMovimentoFinanceiro(t.descricao) || (chave !== null && ignorar.has(chave));
    })
    .map((t) => t.id);
  if (ids.length === 0) return 0;

  await supabase.from("extrato_transacoes").update({ status: "ignorado" }).in("id", ids);
  return ids.length;
}
