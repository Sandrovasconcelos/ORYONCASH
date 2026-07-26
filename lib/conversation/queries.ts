import { createAdminClient } from "@/lib/supabase/admin";

export async function listObrasAtivas() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("status", "ativa")
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export async function listCategorias() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nome")
    .order("nome")
    .limit(10);
  return data ?? [];
}

export async function listEtapas() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("etapas")
    .select("id, nome")
    .order("ordem")
    .limit(10);
  return data ?? [];
}

/**
 * Etapas especificas da obra (importadas de um orcamento), com fallback
 * para o catalogo generico (obra_id nulo) quando a obra nao tem etapas
 * proprias cadastradas.
 */
export async function listEtapasParaObra(obraId: string) {
  const supabase = createAdminClient();
  const { data: proprias } = await supabase
    .from("etapas")
    .select("id, nome")
    .eq("obra_id", obraId)
    .order("ordem")
    .limit(10);

  if (proprias && proprias.length > 0) return proprias;

  const { data: genericas } = await supabase
    .from("etapas")
    .select("id, nome")
    .is("obra_id", null)
    .order("ordem")
    .limit(10);
  return genericas ?? [];
}

/**
 * Grava as etapas extraidas de um orcamento importado (dashboard ou
 * WhatsApp) para uma obra especifica, e atualiza o orcamento_total da
 * obra com a soma dos valores orcados.
 */
export async function upsertEtapasDeObra(
  obraId: string,
  etapas: { nome: string; valorOrcado: number }[]
) {
  const supabase = createAdminClient();

  for (let i = 0; i < etapas.length; i++) {
    const etapa = etapas[i];
    await supabase.from("etapas").upsert(
      {
        obra_id: obraId,
        nome: etapa.nome,
        ordem: i + 1,
        valor_orcado: etapa.valorOrcado,
      },
      { onConflict: "obra_id,nome" }
    );
  }

  const valorTotal = etapas.reduce((soma, e) => soma + e.valorOrcado, 0);
  await supabase
    .from("obras")
    .update({ orcamento_total: valorTotal })
    .eq("id", obraId);
}

export async function findObraById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function findCategoriaById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function findEtapaById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("etapas")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function createObra(nome: string, orcamentoTotal: number) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("obras")
    .insert({ nome, orcamento_total: orcamentoTotal })
    .select("id, nome")
    .single();
  if (error) throw error;
  return data;
}

export async function createMaterial(nome: string, categoriaId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("materiais")
    .insert({ nome, categoria_id: categoriaId })
    .select("id, nome")
    .single();
  if (error) throw error;
  return data;
}

export async function findCategoriaMaterial() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nome")
    .ilike("nome", "material")
    .maybeSingle();
  return data;
}

export async function findOrCreateMaterial(nome: string, categoriaId: string) {
  const supabase = createAdminClient();
  const { data: existente } = await supabase
    .from("materiais")
    .select("id, nome")
    .ilike("nome", nome)
    .maybeSingle();
  if (existente) return existente;
  return createMaterial(nome, categoriaId);
}

export async function createFornecedor(
  nome: string,
  contato: string | null,
  cnpj: string | null = null
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fornecedores")
    .insert({ nome, contato, cnpj })
    .select("id, nome")
    .single();
  if (error) throw error;
  return data;
}

export async function findFornecedorByCnpj(cnpj: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .eq("cnpj", cnpj)
    .maybeSingle();
  return data;
}

export async function findOrCreateFornecedorPorNota(
  nome: string,
  cnpj: string | null
) {
  if (cnpj) {
    const existente = await findFornecedorByCnpj(cnpj);
    if (existente) return existente;
  }
  return createFornecedor(nome, null, cnpj);
}

export async function createDespesa(input: {
  obraId: string;
  categoriaId: string;
  etapaId: string;
  valor: number;
  descricao: string | null;
  materialId?: string | null;
  fornecedorId?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("despesas").insert({
    obra_id: input.obraId,
    categoria_id: input.categoriaId,
    etapa_id: input.etapaId,
    valor: input.valor,
    descricao: input.descricao,
    material_id: input.materialId ?? null,
    fornecedor_id: input.fornecedorId ?? null,
    origem: "whatsapp",
  });
  if (error) throw error;
}

export async function listFornecedores() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .order("nome")
    .limit(10);
  return data ?? [];
}

export async function findFornecedorById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function listMateriais() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("materiais")
    .select("id, nome")
    .order("nome")
    .limit(10);
  return data ?? [];
}

export async function findMaterialById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("materiais")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function deleteObraPorId(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("obras").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteMaterialPorId(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("materiais").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteFornecedorPorId(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) throw error;
}

export async function listDespesasRecentes(limite = 10) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("despesas")
    .select("id, valor, descricao, data, categorias(nome)")
    .order("created_at", { ascending: false })
    .limit(limite);

  return (data ?? []).map((d) => ({
    id: d.id,
    valor: d.valor,
    descricao: d.descricao,
    data: d.data,
    categoriaNome: (d.categorias as unknown as { nome: string } | null)?.nome ?? "—",
  }));
}

export async function findDespesaCompletaById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("despesas")
    .select(
      "id, obra_id, categoria_id, etapa_id, fornecedor_id, valor, descricao, data, obras(nome), categorias(nome), etapas(nome), fornecedores(nome)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    obraId: data.obra_id,
    obraNome: (data.obras as unknown as { nome: string } | null)?.nome ?? "—",
    categoriaId: data.categoria_id,
    categoriaNome: (data.categorias as unknown as { nome: string } | null)?.nome ?? "—",
    etapaId: data.etapa_id,
    etapaNome: (data.etapas as unknown as { nome: string } | null)?.nome ?? "—",
    fornecedorId: data.fornecedor_id,
    fornecedorNome: (data.fornecedores as unknown as { nome: string } | null)?.nome ?? null,
    valor: data.valor,
    descricao: data.descricao,
  };
}

export async function updateDespesaCampo(
  id: string,
  patch: Partial<{
    valor: number;
    descricao: string | null;
    categoria_id: string;
    etapa_id: string;
    fornecedor_id: string;
  }>
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("despesas").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteDespesaPorId(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("despesas").delete().eq("id", id);
  if (error) throw error;
}

export async function getObraResumo(obraId: string) {
  const supabase = createAdminClient();
  const [{ data: obra }, { data: despesas }] = await Promise.all([
    supabase
      .from("obras")
      .select("nome, orcamento_total")
      .eq("id", obraId)
      .maybeSingle(),
    supabase.from("despesas").select("valor").eq("obra_id", obraId),
  ]);

  if (!obra) return null;

  const gastoTotal = (despesas ?? []).reduce((sum, d) => sum + d.valor, 0);
  const saldoRestante = obra.orcamento_total - gastoTotal;
  const percentualInvestido =
    obra.orcamento_total > 0 ? (gastoTotal / obra.orcamento_total) * 100 : 0;

  return {
    nome: obra.nome,
    orcamentoTotal: obra.orcamento_total,
    gastoTotal,
    saldoRestante,
    percentualInvestido,
  };
}
