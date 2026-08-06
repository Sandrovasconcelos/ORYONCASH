import { createAdminClient } from "@/lib/supabase/admin";
import { encontrarContaBancariaCorrespondente } from "@/lib/dashboard/queries";

const COMPROVANTES_BUCKET = "comprovantes";

export type TipoDocumentoDespesa =
  | "documento_cobranca"
  | "comprovante_pagamento"
  | "outro";

export function hojeNoBrasil(): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const ano = partes.find((parte) => parte.type === "year")?.value;
  const mes = partes.find((parte) => parte.type === "month")?.value;
  const dia = partes.find((parte) => parte.type === "day")?.value;

  if (!ano || !mes || !dia) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${ano}-${mes}-${dia}`;
}

export async function listObrasAtivas() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("status", "ativa")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export async function listCategorias() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nome")
    .is("deleted_at", null)
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

export async function uploadComprovanteWhatsApp(input: {
  telefone: string;
  mediaId: string;
  buffer: Buffer;
  mimeType: string;
  tipoDocumento?: TipoDocumentoDespesa;
  contaOrigemBanco?: string | null;
  contaOrigemTitular?: string | null;
  contaOrigemDocumento?: string | null;
  contaOrigemAgencia?: string | null;
  contaOrigemNumero?: string | null;
  metodoPagamento?: string | null;
  numeroDocumento?: string | null;
}) {
  const supabase = createAdminClient();
  const extensao =
    input.mimeType.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") ||
    "bin";
  const storagePath = `whatsapp/${input.telefone}/${Date.now()}-${input.mediaId}.${extensao}`;

  const { error } = await supabase.storage
    .from(COMPROVANTES_BUCKET)
    .upload(storagePath, input.buffer, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) throw error;

  return {
    bucket: COMPROVANTES_BUCKET,
    path: storagePath,
    mimeType: input.mimeType,
    mediaId: input.mediaId,
    tipoDocumento: input.tipoDocumento ?? "documento_cobranca",
    contaOrigemBanco: input.contaOrigemBanco ?? null,
    contaOrigemTitular: input.contaOrigemTitular ?? null,
    contaOrigemDocumento: input.contaOrigemDocumento ?? null,
    contaOrigemAgencia: input.contaOrigemAgencia ?? null,
    contaOrigemNumero: input.contaOrigemNumero ?? null,
    metodoPagamento: input.metodoPagamento ?? null,
    numeroDocumento: input.numeroDocumento ?? null,
    nomeArquivo: `comprovante-${new Date().toISOString().slice(0, 10)}.${extensao}`,
  };
}

export async function vincularComprovanteDespesa(input: {
  despesaId: string;
  comprovante: {
    bucket: string;
    path: string;
    mimeType: string;
    tipoDocumento?: TipoDocumentoDespesa;
    mediaId?: string | null;
    nomeArquivo?: string | null;
    contaOrigemBanco?: string | null;
    contaOrigemTitular?: string | null;
    contaOrigemDocumento?: string | null;
    contaOrigemAgencia?: string | null;
    contaOrigemNumero?: string | null;
    metodoPagamento?: string | null;
    numeroDocumento?: string | null;
  };
}) {
  const supabase = createAdminClient();
  const dadosComContaOrigem = {
    despesa_id: input.despesaId,
    tipo_documento: input.comprovante.tipoDocumento ?? "documento_cobranca",
    whatsapp_media_id: input.comprovante.mediaId ?? null,
    storage_bucket: input.comprovante.bucket,
    storage_path: input.comprovante.path,
    mime_type: input.comprovante.mimeType,
    nome_arquivo: input.comprovante.nomeArquivo ?? null,
    conta_origem_banco: input.comprovante.contaOrigemBanco ?? null,
    conta_origem_titular: input.comprovante.contaOrigemTitular ?? null,
    conta_origem_documento: input.comprovante.contaOrigemDocumento ?? null,
    conta_origem_agencia: input.comprovante.contaOrigemAgencia ?? null,
    conta_origem_numero: input.comprovante.contaOrigemNumero ?? null,
    metodo_pagamento: input.comprovante.metodoPagamento ?? null,
    numero_documento: input.comprovante.numeroDocumento ?? null,
    origem: "whatsapp" as const,
  };

  const { error } = await supabase
    .from("despesa_comprovantes")
    .insert(dadosComContaOrigem);

  if (error) {
    const mensagem = error.message.toLowerCase();
    const erroDeColunaContaOrigem =
      mensagem.includes("conta_origem") ||
      mensagem.includes("metodo_pagamento") ||
      mensagem.includes("numero_documento") ||
      mensagem.includes("column");

    if (!erroDeColunaContaOrigem) throw error;

    const { error: fallbackError } = await supabase.from("despesa_comprovantes").insert({
      despesa_id: input.despesaId,
      tipo_documento: input.comprovante.tipoDocumento ?? "documento_cobranca",
      whatsapp_media_id: input.comprovante.mediaId ?? null,
      storage_bucket: input.comprovante.bucket,
      storage_path: input.comprovante.path,
      mime_type: input.comprovante.mimeType,
      nome_arquivo: input.comprovante.nomeArquivo ?? null,
      origem: "whatsapp",
    });

    if (fallbackError) throw fallbackError;
  }

  if (input.comprovante.tipoDocumento === "comprovante_pagamento") {
    await tentarVincularContaBancaria(
      input.despesaId,
      input.comprovante.contaOrigemBanco ?? null,
      input.comprovante.contaOrigemNumero ?? null,
      input.comprovante.contaOrigemTitular ?? null,
      input.comprovante.contaOrigemDocumento ?? null
    );
  }
}

/**
 * So vincula quando ha exatamente uma conta cadastrada batendo com o que a
 * IA extraiu do comprovante. E so uma conveniencia - nunca deve quebrar o
 * lancamento da despesa, entao qualquer erro (inclusive a tabela ainda nao
 * existir) e silenciosamente ignorado.
 */
async function tentarVincularContaBancaria(
  despesaId: string,
  banco: string | null,
  numero: string | null,
  titular: string | null,
  documento: string | null
) {
  if (!banco && !numero && !titular && !documento) return;

  try {
    const supabase = createAdminClient();
    const completa = await supabase
      .from("contas_bancarias")
      .select("id, banco, numero, titular, documento")
      .is("deleted_at", null);
    // titular/documento podem ainda nao existir se a migration nao rodou.
    const { data: contas, error } = completa.error
      ? await supabase.from("contas_bancarias").select("id, banco, numero").is("deleted_at", null)
      : completa;
    if (error || !contas || contas.length === 0) return;

    const contaId = encontrarContaBancariaCorrespondente({ banco, numero, titular, documento }, contas);
    if (!contaId) return;

    await supabase
      .from("despesas")
      .update({ conta_bancaria_id: contaId })
      .eq("id", despesaId)
      .is("conta_bancaria_id", null);
  } catch {
    // vinculo automatico de conta bancaria e opcional - falha aqui nao pode
    // impedir o lancamento da despesa.
  }
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
    .is("deleted_at", null)
    .maybeSingle();
  if (existente) return existente;
  return createMaterial(nome, categoriaId);
}

type CamposFornecedor = {
  cnpj?: string | null;
  cpf?: string | null;
  chavePix?: string | null;
  contaBanco?: string | null;
  contaAgencia?: string | null;
  contaNumero?: string | null;
};

function normalizarNomeFornecedor(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export async function createFornecedor(
  nome: string,
  contato: string | null,
  campos: CamposFornecedor = {}
) {
  const supabase = createAdminClient();
  const completo = {
    nome,
    contato,
    cnpj: campos.cnpj ?? null,
    cpf: campos.cpf ?? null,
    chave_pix: campos.chavePix ?? null,
    conta_banco: campos.contaBanco ?? null,
    conta_agencia: campos.contaAgencia ?? null,
    conta_numero: campos.contaNumero ?? null,
  };

  const { data, error } = await supabase
    .from("fornecedores")
    .insert(completo)
    .select("id, nome")
    .single();
  if (!error) return data;

  // Colunas novas (cpf/chave_pix/conta_*) podem nao existir ainda (migration
  // pendente) - tenta de novo so com os campos base ja garantidos.
  const { data: dataReduzido, error: erroReduzido } = await supabase
    .from("fornecedores")
    .insert({ nome, contato, cnpj: campos.cnpj ?? null })
    .select("id, nome")
    .single();
  if (erroReduzido) throw erroReduzido;
  return dataReduzido;
}

export async function findFornecedorByCnpj(cnpj: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .eq("cnpj", cnpj)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

async function findFornecedorByCpf(cpf: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .eq("cpf", cpf)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return null; // coluna cpf pode nao existir ainda (migration pendente)
  return data;
}

async function findFornecedorPorNomeNormalizado(nome: string) {
  const supabase = createAdminClient();
  const alvo = normalizarNomeFornecedor(nome);
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .is("deleted_at", null);

  return (data ?? []).find((f) => normalizarNomeFornecedor(f.nome) === alvo) ?? null;
}

async function backfillDadosFornecedor(fornecedorId: string, novos: CamposFornecedor) {
  const supabase = createAdminClient();
  const { data: atual, error } = await supabase
    .from("fornecedores")
    .select("cnpj, cpf, chave_pix, conta_banco, conta_agencia, conta_numero")
    .eq("id", fornecedorId)
    .maybeSingle();
  if (error || !atual) return; // colunas novas podem nao existir ainda

  const patch: {
    cnpj?: string;
    cpf?: string;
    chave_pix?: string;
    conta_banco?: string;
    conta_agencia?: string;
    conta_numero?: string;
  } = {};
  if (!atual.cnpj && novos.cnpj) patch.cnpj = novos.cnpj;
  if (!atual.cpf && novos.cpf) patch.cpf = novos.cpf;
  if (!atual.chave_pix && novos.chavePix) patch.chave_pix = novos.chavePix;
  if (!atual.conta_banco && novos.contaBanco) patch.conta_banco = novos.contaBanco;
  if (!atual.conta_agencia && novos.contaAgencia) patch.conta_agencia = novos.contaAgencia;
  if (!atual.conta_numero && novos.contaNumero) patch.conta_numero = novos.contaNumero;

  if (Object.keys(patch).length === 0) return;
  await supabase.from("fornecedores").update(patch).eq("id", fornecedorId);
}

/**
 * Resolve o fornecedor de um documento extraido (nota/comprovante), evitando
 * duplicar cadastro: tenta por CNPJ, depois CPF, depois nome normalizado
 * identico (sem acento/case) - de proposito NAO usa correspondencia
 * aproximada por palavras aqui (essa fusao e automatica, em background;
 * correspondencia aproximada e melhor reservada pra fluxos onde um humano
 * confirma, como listMateriaisSemelhantes). Se achar, faz backfill dos
 * campos novos que estiverem vazios no cadastro existente.
 */
export async function findOrCreateFornecedorPorNota(dados: {
  nome: string;
} & CamposFornecedor) {
  const { nome, ...campos } = dados;

  let existente: { id: string; nome: string } | null = null;
  if (campos.cnpj) existente = await findFornecedorByCnpj(campos.cnpj);
  if (!existente && campos.cpf) existente = await findFornecedorByCpf(campos.cpf);
  if (!existente) existente = await findFornecedorPorNomeNormalizado(nome);

  if (existente) {
    await backfillDadosFornecedor(existente.id, campos);
    return existente;
  }

  return createFornecedor(nome, null, campos);
}

export async function createDespesa(input: {
  obraId: string;
  categoriaId: string;
  etapaId: string;
  valor: number;
  descricao: string | null;
  materialId?: string | null;
  fornecedorId?: string | null;
  criadoPorTelefone?: string | null;
  criadoPorNome?: string | null;
}) {
  const supabase = createAdminClient();
  const base = {
    obra_id: input.obraId,
    categoria_id: input.categoriaId,
    etapa_id: input.etapaId,
    valor: input.valor,
    descricao: input.descricao,
    material_id: input.materialId ?? null,
    fornecedor_id: input.fornecedorId ?? null,
    data: hojeNoBrasil(),
    origem: "whatsapp" as const,
  };

  const comAutoria = {
    ...base,
    criado_por_telefone: input.criadoPorTelefone ?? null,
    criado_por_nome: input.criadoPorNome ?? null,
  };

  let result = await supabase
    .from("despesas")
    .insert(comAutoria)
    .select("id")
    .single();

  if (
    result.error &&
    result.error.message.toLowerCase().includes("criado_por")
  ) {
    result = await supabase.from("despesas").insert(base).select("id").single();
  }

  if (result.error) throw result.error;
  return result.data;
}

export async function listFornecedores() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .is("deleted_at", null)
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
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export async function listMateriais() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("materiais")
    .select("id, nome")
    .is("deleted_at", null)
    .order("nome")
    .limit(10);
  return data ?? [];
}

export async function listMateriaisSemelhantes(termo: string, limite = 8) {
  const palavras = termo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length >= 3)
    .slice(0, 3);

  if (palavras.length === 0) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("materiais")
    .select("id, nome")
    .or(palavras.map((p) => `nome.ilike.%${p}%`).join(","))
    .is("deleted_at", null)
    .order("nome")
    .limit(limite);
  return data ?? [];
}

export async function findMaterialById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("materiais")
    .select("id, nome")
    .eq("id", id)
    .is("deleted_at", null)
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
    .is("deleted_at", null)
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

export async function findDespesaRecenteParaComprovantePagamento() {
  const supabase = createAdminClient();
  const limiteTempo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("despesas")
    .select("id, valor, descricao, created_at")
    .eq("origem", "whatsapp")
    .is("deleted_at", null)
    .gte("created_at", limiteTempo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function findDespesaCompletaById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("despesas")
    .select(
      "id, obra_id, categoria_id, etapa_id, material_id, fornecedor_id, valor, descricao, data, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome)"
    )
    .eq("id", id)
    .is("deleted_at", null)
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
    materialId: data.material_id,
    materialNome: (data.materiais as unknown as { nome: string } | null)?.nome ?? null,
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
    material_id: string | null;
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
    supabase.from("despesas").select("valor").eq("obra_id", obraId).is("deleted_at", null),
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
