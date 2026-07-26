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
