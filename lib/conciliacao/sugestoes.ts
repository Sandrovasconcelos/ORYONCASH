import { createAdminClient } from "@/lib/supabase/admin";
import { encontrarPorPista } from "@/lib/conversation/queries";
import { nomeDoBeneficiario } from "./classificar";

export type SugestaoLancamento = {
  fornecedorId: string;
  fornecedorNome: string;
  obraId: string | null;
  categoriaId: string | null;
  baseadaEm: number;
};

/**
 * Pra cada transacao sem lancamento, tenta reconhecer o beneficiario do PIX
 * entre os fornecedores cadastrados e sugere obra + categoria a partir do que
 * o app ja lancou pra esse fornecedor (o par mais frequente). So sugere
 * quando o nome bate com UM fornecedor e ha historico - nunca chuta.
 */
export async function sugerirLancamentos(
  transacoes: { id: string; descricao: string | null }[]
): Promise<Map<string, SugestaoLancamento>> {
  const resultado = new Map<string, SugestaoLancamento>();
  if (transacoes.length === 0) return resultado;

  const supabase = createAdminClient();
  const desde = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [{ data: fornecedores }, { data: despesas }] = await Promise.all([
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null),
    supabase
      .from("despesas")
      .select("fornecedor_id, obra_id, categoria_id")
      .not("fornecedor_id", "is", null)
      .is("deleted_at", null)
      .gte("data", desde)
      .limit(5000),
  ]);
  if (!fornecedores || !despesas) return resultado;

  const pares = new Map<string, Map<string, { obraId: string | null; categoriaId: string; n: number }>>();
  for (const d of despesas) {
    if (!d.fornecedor_id) continue;
    const porFornecedor = pares.get(d.fornecedor_id) ?? new Map();
    const chave = `${d.obra_id ?? ""}|${d.categoria_id}`;
    const atual = porFornecedor.get(chave) ?? { obraId: d.obra_id, categoriaId: d.categoria_id, n: 0 };
    atual.n++;
    porFornecedor.set(chave, atual);
    pares.set(d.fornecedor_id, porFornecedor);
  }

  for (const t of transacoes) {
    const nome = nomeDoBeneficiario(t.descricao);
    if (!nome) continue;
    const fornecedor = encontrarPorPista(fornecedores, nome);
    if (!fornecedor) continue;

    const historico = pares.get(fornecedor.id);
    const melhor = historico ? [...historico.values()].sort((a, b) => b.n - a.n)[0] : null;
    const total = historico ? [...historico.values()].reduce((s, p) => s + p.n, 0) : 0;
    resultado.set(t.id, {
      fornecedorId: fornecedor.id,
      fornecedorNome: fornecedor.nome,
      obraId: melhor?.obraId ?? null,
      categoriaId: melhor?.categoriaId ?? null,
      baseadaEm: total,
    });
  }
  return resultado;
}
