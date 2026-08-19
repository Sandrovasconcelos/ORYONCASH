import { createAdminClient } from "@/lib/supabase/admin";
import { encontrarContaBancariaCorrespondente } from "@/lib/dashboard/queries";
import { notificarLancamento } from "@/lib/alertas/notificar";
import type { Database } from "@/lib/database.types";

type DespesaInsert = Database["public"]["Tables"]["despesas"]["Insert"];

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

// Teto de seguranca pras listas mandadas por texto no WhatsApp (antes era
// 10, limite da mensagem interativa de lista da API) - mensagem de texto
// nao tem esse limite, mas ainda vale proteger contra uma mensagem gigante
// se o cadastro crescer muito.
const TETO_LISTA_TEXTO = 60;

export async function listObrasAtivas() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("status", "ativa")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(TETO_LISTA_TEXTO);
  return data ?? [];
}

export async function listCategorias() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nome, usa_etapa")
    .is("deleted_at", null)
    .order("nome")
    .limit(TETO_LISTA_TEXTO);
  return data ?? [];
}

export async function listEtapas() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("etapas")
    .select("id, nome")
    .is("deleted_at", null)
    .order("ordem")
    .limit(10);
  return data ?? [];
}

/**
 * Poe etapas ainda nao concluidas (percentual_executado < 100) antes das
 * ja concluidas, mantendo a ordem do cronograma (campo "ordem") dentro de
 * cada grupo. Sem isso, uma obra com 20+ etapas trava a lista do WhatsApp
 * (limite de 10 itens) sempre nas mesmas primeiras etapas cadastradas -
 * mesmo que elas ja tenham sido finalizadas ha tempos e a obra ja esteja
 * trabalhando em etapas mais adiante no cronograma.
 */
function ordenarPorProgresso<T extends { ordem: number; percentual_executado: number }>(
  etapas: T[]
): T[] {
  return [...etapas].sort((a, b) => {
    const aConcluida = a.percentual_executado >= 100 ? 1 : 0;
    const bConcluida = b.percentual_executado >= 100 ? 1 : 0;
    if (aConcluida !== bConcluida) return aConcluida - bConcluida;
    return a.ordem - b.ordem;
  });
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
    .select("id, nome, ordem, percentual_executado")
    .eq("obra_id", obraId)
    .is("deleted_at", null)
    .order("ordem");

  if (proprias && proprias.length > 0) {
    return ordenarPorProgresso(proprias).slice(0, TETO_LISTA_TEXTO);
  }

  const { data: genericas } = await supabase
    .from("etapas")
    .select("id, nome, ordem, percentual_executado")
    .is("obra_id", null)
    .is("deleted_at", null)
    .order("ordem");
  return ordenarPorProgresso(genericas ?? []).slice(0, TETO_LISTA_TEXTO);
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

export type DespesaDuplicada = {
  valor: number;
  data: string;
  obraNome: string;
};

/**
 * Checa se ja existe alguma despesa (nao apagada) com esse mesmo numero de
 * documento vinculado - usado pra avisar antes de lancar uma nota fiscal
 * que ja foi processada antes (reenvio acidental).
 */
export async function buscarDespesasPorNumeroDocumento(
  numeroDocumento: string
): Promise<DespesaDuplicada[]> {
  const termo = numeroDocumento.trim();
  if (!termo) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("despesa_comprovantes")
    .select("despesa_id, despesas!inner(valor, data, deleted_at, obras(nome))")
    .eq("numero_documento", termo);
  if (error || !data) return [];

  return data
    .map((item) => item.despesas as unknown as { valor: number; data: string; deleted_at: string | null; obras: { nome: string } | null })
    .filter((d) => !d.deleted_at)
    .map((d) => ({ valor: d.valor, data: d.data, obraNome: d.obras?.nome ?? "-" }));
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
    .select("id, nome, usa_etapa")
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
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

function normalizarTextoBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Casa um texto digitado com o "nome" de exatamente um item de uma lista -
 * usado toda vez que uma lista de toque do WhatsApp so mostra os 10
 * primeiros (limite da API) e precisamos de um jeito de escolher por texto
 * pros itens 11+. Tenta match exato primeiro, depois substring nos dois
 * sentidos; so decide quando sobra exatamente um candidato - ambiguo ou sem
 * nenhuma batida retorna null (nunca adivinha).
 */
function encontrarUnicoPorNome<T extends { nome: string }>(
  itens: T[],
  texto: string
): T | null {
  if (!texto.trim() || itens.length === 0) return null;

  const termo = normalizarTextoBusca(texto);

  const exato = itens.find((i) => normalizarTextoBusca(i.nome) === termo);
  if (exato) return exato;

  const candidatos = itens.filter((i) => {
    const nome = normalizarTextoBusca(i.nome);
    return nome.includes(termo) || termo.includes(nome);
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

/**
 * Extensao de encontrarUnicoPorNome pra aceitar tambem o numero da posicao
 * na lista numerada mandada por texto (ex: "3") - precisa ser chamado com
 * exatamente os mesmos itens, na mesma ordem, que foram numerados na
 * mensagem (listObrasAtivas/listCategorias/etc, sem limite).
 */
function resolverPorNumeroOuNome<T extends { nome: string }>(itens: T[], texto: string): T | null {
  const termo = texto.trim();
  if (/^\d+$/.test(termo)) {
    return itens[Number(termo) - 1] ?? null;
  }
  return encontrarUnicoPorNome(itens, texto);
}

export async function findEtapaPorTexto(obraId: string, texto: string) {
  const etapas = await listEtapasParaObra(obraId);
  return resolverPorNumeroOuNome(etapas, texto);
}

export async function findObraPorTexto(texto: string) {
  const obras = await listObrasAtivas();
  return resolverPorNumeroOuNome(obras, texto);
}

export async function findCategoriaPorTexto(texto: string) {
  const categorias = await listCategorias();
  return resolverPorNumeroOuNome(categorias, texto);
}

export async function findFornecedorPorTexto(texto: string) {
  const fornecedores = await listFornecedores();
  return resolverPorNumeroOuNome(fornecedores, texto);
}

export async function findMaterialPorTexto(texto: string) {
  const materiais = await listMateriais();
  return resolverPorNumeroOuNome(materiais, texto);
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
  etapaId: string | null;
  valor: number;
  descricao: string | null;
  quantidade?: number | null;
  valorUnitario?: number | null;
  materialId?: string | null;
  fornecedorId?: string | null;
  criadoPorTelefone?: string | null;
  criadoPorNome?: string | null;
}) {
  const supabase = createAdminClient();
  const comAutoria: DespesaInsert = {
    obra_id: input.obraId,
    categoria_id: input.categoriaId,
    etapa_id: input.etapaId,
    valor: input.valor,
    descricao: input.descricao,
    quantidade: input.quantidade ?? null,
    valor_unitario: input.valorUnitario ?? null,
    material_id: input.materialId ?? null,
    fornecedor_id: input.fornecedorId ?? null,
    data: hojeNoBrasil(),
    origem: "whatsapp" as const,
    criado_por_telefone: input.criadoPorTelefone ?? null,
    criado_por_nome: input.criadoPorNome ?? null,
  };

  // Retenta sem criado_por_* e/ou quantidade/valor_unitario se essas
  // migrations ainda nao tiverem rodado no banco - mesma logica defensiva
  // ja usada em outros pontos do app pra colunas novas.
  let payload = comAutoria;
  let result = await supabase.from("despesas").insert(payload).select("id").single();
  for (let tentativa = 0; tentativa < 2 && result.error; tentativa++) {
    const msg = result.error.message.toLowerCase();
    if (msg.includes("criado_por") && "criado_por_telefone" in payload) {
      const { criado_por_telefone: _telefoneIgnorado, criado_por_nome: _nomeIgnorado, ...resto } = payload;
      void _telefoneIgnorado;
      void _nomeIgnorado;
      payload = resto;
    } else if (
      (msg.includes("quantidade") || msg.includes("valor_unitario")) &&
      "quantidade" in payload
    ) {
      const { quantidade: _quantidadeIgnorada, valor_unitario: _valorUnitarioIgnorado, ...resto } = payload;
      void _quantidadeIgnorada;
      void _valorUnitarioIgnorado;
      payload = resto;
    } else {
      break;
    }
    result = await supabase.from("despesas").insert(payload).select("id").single();
  }

  if (result.error) throw result.error;

  notificarLancamento({
    valor: input.valor,
    categoriaId: input.categoriaId,
    obraId: input.obraId,
    autorTelefone: input.criadoPorTelefone ?? null,
    autorNome: input.criadoPorNome ?? null,
  }).catch((error) => console.error("Falha ao notificar lançamento por WhatsApp:", error));

  return result.data;
}

export async function listFornecedores() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .is("deleted_at", null)
    .order("nome")
    .limit(TETO_LISTA_TEXTO);
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
    .limit(TETO_LISTA_TEXTO);
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

/**
 * Busca despesas por descricao ou nome do fornecedor - usado quando o
 * lancamento que o usuario quer corrigir/anexar pagamento nao esta entre
 * os 10 mais recentes mostrados na lista de toque (limite do WhatsApp).
 */
export async function buscarDespesasPorTexto(termo: string, limite = 10) {
  if (!termo.trim()) return [];

  const supabase = createAdminClient();
  const [porDescricao, porFornecedor] = await Promise.all([
    supabase
      .from("despesas")
      .select("id, valor, descricao, data, categorias(nome)")
      .is("deleted_at", null)
      .ilike("descricao", `%${termo}%`)
      .order("created_at", { ascending: false })
      .limit(limite),
    supabase
      .from("despesas")
      .select("id, valor, descricao, data, categorias(nome), fornecedores!inner(nome)")
      .is("deleted_at", null)
      .ilike("fornecedores.nome", `%${termo}%`)
      .order("created_at", { ascending: false })
      .limit(limite),
  ]);

  const vistos = new Set<string>();
  const resultado: { id: string; valor: number; descricao: string | null; data: string; categoriaNome: string }[] = [];
  for (const d of [...(porDescricao.data ?? []), ...(porFornecedor.data ?? [])]) {
    if (vistos.has(d.id)) continue;
    vistos.add(d.id);
    resultado.push({
      id: d.id,
      valor: d.valor,
      descricao: d.descricao,
      data: d.data,
      categoriaNome: (d.categorias as unknown as { nome: string } | null)?.nome ?? "—",
    });
    if (resultado.length >= limite) break;
  }
  return resultado;
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
