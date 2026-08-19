"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, parseValorBR } from "@/lib/conversation/format";
import { hojeNoBrasil, upsertEtapasDeObra } from "@/lib/conversation/queries";
import { calcularItensElegiveisParaMedicao } from "@/lib/dashboard/queries";
import { extractSpreadsheetAsText } from "@/lib/orcamento/parseSpreadsheet";
import { extractOrcamentoData } from "@/lib/gemini/extractOrcamento";
import { registrarAtividade } from "@/lib/atividades";
import { enviarNotificacaoDiaria, numeroNotificacao } from "@/lib/alertas/notificar";
import { buscarDadosRelatorio, type FiltrosRelatorio } from "@/lib/relatorio/dados";
import { gerarRelatorioPdfBuffer } from "@/lib/relatorio/pdf";
import { sendDocument } from "@/lib/whatsapp/messages";
import { formatDataHoraBrasil } from "@/lib/format-date";

const LIXEIRA_ENTIDADES = {
  obra: { tabela: "obras", nome: "Obra", rota: "/dashboard/obras" },
  categoria: { tabela: "categorias", nome: "Categoria", rota: "/dashboard/categorias" },
  material: { tabela: "materiais", nome: "Material", rota: "/dashboard/materiais" },
  fornecedor: {
    tabela: "fornecedores",
    nome: "Fornecedor",
    rota: "/dashboard/fornecedores",
  },
  despesa: { tabela: "despesas", nome: "Despesa", rota: "/dashboard/despesas" },
  medicao: { tabela: "medicoes", nome: "Medição", rota: "/dashboard/cronograma" },
  etapa: { tabela: "etapas", nome: "Etapa", rota: "/dashboard/obras" },
  contrato_fornecedor: {
    tabela: "contratos_fornecedor",
    nome: "Contrato de fornecedor",
    rota: "/dashboard/cronograma",
  },
  cronograma_template: {
    tabela: "cronograma_templates",
    nome: "Modelo de cronograma",
    rota: "/dashboard/cronograma",
  },
  checklist_template: {
    tabela: "checklist_templates",
    nome: "Modelo de checklist",
    rota: "/dashboard/execucao",
  },
  conta_bancaria: {
    tabela: "contas_bancarias",
    nome: "Conta bancária",
    rota: "/dashboard/contas",
  },
} as const;

type TipoLixeira = keyof typeof LIXEIRA_ENTIDADES;
type TipoDocumentoComprovante = "documento_cobranca" | "comprovante_pagamento" | "outro";

function isTipoLixeira(tipo: string): tipo is TipoLixeira {
  return tipo in LIXEIRA_ENTIDADES;
}

function isTipoDocumentoComprovante(tipo: string): tipo is TipoDocumentoComprovante {
  return ["documento_cobranca", "comprovante_pagamento", "outro"].includes(tipo);
}

async function getAutorNomeDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "Usuário do dashboard";
}

const TAMANHO_MAXIMO_ARQUIVO_BYTES = 15 * 1024 * 1024;

const MIME_TYPES_IMAGEM_OU_PDF = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const MIME_TYPES_CONTRATO = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function validarArquivo(arquivo: File, mimesPermitidos: Set<string>) {
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
    throw new Error(
      `Arquivo "${arquivo.name}" tem ${(arquivo.size / (1024 * 1024)).toFixed(1)}MB - o limite é 15MB.`
    );
  }
  if (arquivo.type && !mimesPermitidos.has(arquivo.type)) {
    throw new Error(
      `Tipo de arquivo "${arquivo.type || "desconhecido"}" não é aceito para "${arquivo.name}".`
    );
  }
}

async function anexarArquivoDespesa(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  despesaId: string;
  tipoDocumento: TipoDocumentoComprovante;
  arquivo: File;
  autorNome: string;
}) {
  const { supabase, despesaId, tipoDocumento, arquivo, autorNome } = input;

  if (arquivo.size === 0) return;
  validarArquivo(arquivo, MIME_TYPES_IMAGEM_OU_PDF);

  const extensao =
    arquivo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() ||
    arquivo.type.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") ||
    "bin";
  const nomeSeguro = arquivo.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 70);
  const storagePath = `dashboard/${despesaId}/${Date.now()}-${crypto.randomUUID()}-${nomeSeguro || "arquivo"}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from("comprovantes")
    .upload(storagePath, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("despesa_comprovantes").insert({
    despesa_id: despesaId,
    tipo_documento: tipoDocumento,
    storage_bucket: "comprovantes",
    storage_path: storagePath,
    mime_type: arquivo.type || "application/octet-stream",
    nome_arquivo: arquivo.name,
    origem: "dashboard",
  });

  if (insertError) throw insertError;

  const label =
    tipoDocumento === "comprovante_pagamento"
      ? "comprovante de pagamento"
      : tipoDocumento === "documento_cobranca"
        ? "conta/nota"
        : "documento";

  await registrarAtividade({
    tipo: "edicao",
    entidade: "despesa",
    entidadeId: despesaId,
    origem: "dashboard",
    autorNome,
    resumo: `${label} anexado(a) pelo dashboard por ${autorNome}`,
    dadosDepois: {
      tipo_documento: tipoDocumento,
      nome_arquivo: arquivo.name,
      storage_path: storagePath,
    },
  });
}

async function anexarArquivosSelecionadosNoFormulario(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  formData: FormData;
  despesaId: string;
  autorNome: string;
}) {
  for (const tipoDocumento of ["documento_cobranca", "comprovante_pagamento"] as const) {
    const arquivo = input.formData.get(`arquivo_${tipoDocumento}`);
    if (arquivo instanceof File && arquivo.size > 0) {
      await anexarArquivoDespesa({
        supabase: input.supabase,
        despesaId: input.despesaId,
        tipoDocumento,
        arquivo,
        autorNome: input.autorNome,
      });
    }
  }
}

async function anexarArquivoContrato(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  contratoId: string;
  arquivo: File;
}) {
  const { supabase, contratoId, arquivo } = input;
  if (arquivo.size === 0) return;
  validarArquivo(arquivo, MIME_TYPES_CONTRATO);

  const extensao =
    arquivo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const nomeSeguro = arquivo.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 70);
  const storagePath = `contratos/${contratoId}/${Date.now()}-${crypto.randomUUID()}-${nomeSeguro || "contrato"}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from("comprovantes")
    .upload(storagePath, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  await supabase
    .from("contratos_fornecedor")
    .update({
      arquivo_storage_path: storagePath,
      arquivo_nome: arquivo.name,
      arquivo_mime_type: arquivo.type || "application/octet-stream",
    })
    .eq("id", contratoId);
}

export async function excluirArquivoContratoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contratos_fornecedor")
    .select("arquivo_storage_path, obra_id")
    .eq("id", id)
    .maybeSingle();
  if (!contrato) return;

  if (contrato.arquivo_storage_path) {
    await supabase.storage.from("comprovantes").remove([contrato.arquivo_storage_path]);
  }
  await supabase
    .from("contratos_fornecedor")
    .update({ arquivo_storage_path: null, arquivo_nome: null, arquivo_mime_type: null })
    .eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: contrato.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Arquivo do contrato de fornecedor removido por ${autorNome}`,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createObraAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const orcamentoTotal = parseValorBR(String(formData.get("orcamento") ?? "0")) ?? 0;
  if (!nome) return;

  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obras")
    .insert({ nome, orcamento_total: orcamentoTotal })
    .select("id")
    .single();

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: obra?.id,
    origem: "dashboard",
    autorNome,
    resumo: `Obra "${nome}" cadastrada (orçamento ${formatBRL(orcamentoTotal)}) por ${autorNome}`,
    dadosDepois: { nome, orcamentoTotal },
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard");
}

export async function updateObraAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const orcamentoTotal = parseValorBR(String(formData.get("orcamento") ?? "0")) ?? 0;
  const status = String(formData.get("status") ?? "ativa") as "ativa" | "concluida";
  const categoriaMedicaoPadraoId = String(formData.get("categoria_medicao_padrao_id") ?? "") || null;
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("obras")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = {
    nome,
    orcamento_total: orcamentoTotal,
    status,
    categoria_medicao_padrao_id: categoriaMedicaoPadraoId,
  };
  await supabase.from("obras").update(depois).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Obra "${nome}" editada por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

export async function moveObraToTrashAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obras")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!obra) return;

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("obras")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: autorNome,
      deleted_reason: motivo,
    })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "obra",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Obra "${obra.nome}" enviada para a lixeira por ${autorNome}`,
    dadosAntes: obra,
    dadosDepois: { deleted: true, motivo },
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/despesas");
}

export async function restoreObraFromTrashAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obras")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!obra) return;

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("obras")
    .update({
      deleted_at: null,
      deleted_by: null,
      deleted_reason: null,
    })
    .eq("id", id);

  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Obra "${obra.nome}" restaurada da lixeira por ${autorNome}`,
    dadosAntes: obra,
    dadosDepois: { restored: true },
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard");
}

export async function permanentlyDeleteObraAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obras")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!obra?.deleted_at) return;

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "obra",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Obra "${obra.nome}" apagada definitivamente por ${autorNome}`,
    dadosAntes: obra,
    dadosDepois: { permanentlyDeleted: true },
  });

  await supabase.from("obras").delete().eq("id", id);

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard");
}

export async function createEtapaAction(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const ordem = Number(formData.get("ordem") ?? 0) || 1;
  const valorOrcado = parseValorBR(String(formData.get("valor_orcado") ?? "0")) ?? 0;
  if (!obraId || !nome) return;

  const supabase = await createClient();
  const { data: etapa } = await supabase
    .from("etapas")
    .insert({
      obra_id: obraId,
      nome,
      ordem,
      valor_orcado: valorOrcado,
    })
    .select("id")
    .single();

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: obraId,
    origem: "dashboard",
    autorNome,
    resumo: `Etapa "${nome}" cadastrada na obra por ${autorNome}`,
    dadosDepois: { id: etapa?.id, obraId, nome, ordem, valorOrcado },
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

export async function updateEtapaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const ordem = Number(formData.get("ordem") ?? 0) || 1;
  const valorOrcado = parseValorBR(String(formData.get("valor_orcado") ?? "0")) ?? 0;
  if (!id || !obraId || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("etapas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = { nome, ordem, valor_orcado: valorOrcado };
  await supabase.from("etapas").update(depois).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: obraId,
    origem: "dashboard",
    autorNome,
    resumo: `Etapa "${nome}" editada por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

/**
 * Chamada direto de um Client Component (nao via <form action>), pelo
 * modal de edicao da celula etapa x mes - por isso recebe um objeto em
 * vez de FormData e devolve {ok, error} pro modal mostrar feedback.
 */
export async function salvarDistribuicaoEtapaMesAction(input: {
  etapaId: string;
  mes: string;
  percentual: number;
  duracaoDias: number;
  observacao: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.etapaId || !input.mes) {
    return { ok: false, error: "Dados incompletos." };
  }
  const percentual = Math.max(0, Math.min(100, input.percentual));
  const duracaoDias = Math.max(0, Math.round(input.duracaoDias || 0));

  const supabase = await createClient();
  const { data: etapa } = await supabase
    .from("etapas")
    .select("nome")
    .eq("id", input.etapaId)
    .maybeSingle();

  const { error } = await supabase.from("etapa_distribuicao_mensal").upsert(
    {
      etapa_id: input.etapaId,
      mes: input.mes,
      percentual,
      duracao_dias: duracaoDias,
      observacao: input.observacao,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "etapa_id,mes" }
  );
  if (error) return { ok: false, error: error.message };

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "etapa",
    entidadeId: input.etapaId,
    origem: "dashboard",
    autorNome,
    resumo: `Distribuição mensal de "${etapa?.nome ?? input.etapaId}" (${input.mes}) editada por ${autorNome}: ${percentual}%`,
    dadosDepois: input,
  });

  revalidatePath("/dashboard/cronograma");
  return { ok: true };
}

export async function deleteEtapaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  let obraId = String(formData.get("obra_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: etapa } = await supabase.from("etapas").select("*").eq("id", id).maybeSingle();
  obraId = obraId || etapa?.obra_id || "";

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("etapas")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: autorNome,
      deleted_reason: motivo,
    })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "etapa",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Etapa "${etapa?.nome ?? id}" enviada para a lixeira por ${autorNome}`,
    dadosAntes: etapa,
    dadosDepois: { deleted: true, motivo },
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard/lixeira");
  revalidatePath("/dashboard");
}

export async function copiarEtapasAction(formData: FormData) {
  const obraOrigemId = String(formData.get("obra_origem_id") ?? "");
  const obrasDestino = formData
    .getAll("obra_destino_id")
    .map(String)
    .filter((id) => id && id !== obraOrigemId);
  if (!obraOrigemId || obrasDestino.length === 0) return;

  const supabase = await createClient();
  const { data: etapasOrigem } = await supabase
    .from("etapas")
    .select("nome, ordem, valor_orcado")
    .eq("obra_id", obraOrigemId)
    .is("deleted_at", null)
    .order("ordem");
  if (!etapasOrigem || etapasOrigem.length === 0) return;

  const autorNome = await getAutorNomeDashboard();

  for (const obraDestinoId of obrasDestino) {
    const { data: etapasExistentes } = await supabase
      .from("etapas")
      .select("ordem")
      .eq("obra_id", obraDestinoId)
      .is("deleted_at", null);
    const maiorOrdemAtual = Math.max(0, ...(etapasExistentes ?? []).map((e) => e.ordem ?? 0));

    const novasEtapas = etapasOrigem.map((etapa, indice) => ({
      obra_id: obraDestinoId,
      nome: etapa.nome,
      ordem: maiorOrdemAtual + indice + 1,
      valor_orcado: etapa.valor_orcado,
    }));

    await supabase.from("etapas").insert(novasEtapas);

    await registrarAtividade({
      tipo: "criacao",
      entidade: "obra",
      entidadeId: obraDestinoId,
      origem: "dashboard",
      autorNome,
      resumo: `${novasEtapas.length} etapa(s) copiada(s) de outra obra por ${autorNome}`,
      dadosDepois: { etapas: novasEtapas.map((e) => e.nome) },
    });
  }

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard");
}

export async function createMaterialAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const categoriaId = String(formData.get("categoria_id") ?? "") || null;
  if (!nome) return;

  const supabase = await createClient();
  const { data: material } = await supabase
    .from("materiais")
    .insert({ nome, categoria_id: categoriaId })
    .select("id")
    .single();

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "material",
    entidadeId: material?.id,
    origem: "dashboard",
    autorNome,
    resumo: `Material "${nome}" cadastrado por ${autorNome}`,
    dadosDepois: { nome, categoriaId },
  });

  revalidatePath("/dashboard/materiais");
}

export async function createCategoriaAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const usaEtapa = formData.get("usa_etapa") === "on";
  if (!nome) return;

  const supabase = await createClient();
  const { data: categoria } = await supabase
    .from("categorias")
    .insert({ nome, usa_etapa: usaEtapa })
    .select("id")
    .single();

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "categoria",
    entidadeId: categoria?.id,
    origem: "dashboard",
    autorNome,
    resumo: `Categoria "${nome}" cadastrada por ${autorNome}`,
    dadosDepois: { nome, usa_etapa: usaEtapa },
  });

  revalidatePath("/dashboard/categorias");
  revalidatePath("/dashboard/materiais");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

export async function updateCategoriaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const usaEtapa = formData.get("usa_etapa") === "on";
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("categorias")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("categorias").update({ nome, usa_etapa: usaEtapa }).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Categoria "${nome}" editada por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: { nome, usa_etapa: usaEtapa },
  });

  revalidatePath("/dashboard/categorias");
  revalidatePath("/dashboard/materiais");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

export async function deleteCategoriaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  const { data: categoria } = await supabase
    .from("categorias")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("categorias")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: autorNome,
      deleted_reason: motivo,
    })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Categoria "${categoria?.nome ?? id}" enviada para a lixeira por ${autorNome}`,
    dadosAntes: categoria,
    dadosDepois: { deleted: true, motivo },
  });

  revalidatePath("/dashboard/categorias");
  revalidatePath("/dashboard/materiais");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lixeira");
}

export async function updateMaterialAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const categoriaId = String(formData.get("categoria_id") ?? "") || null;
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("materiais")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("materiais")
    .update({ nome, categoria_id: categoriaId })
    .eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "material",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Material "${nome}" editado por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: { nome, categoriaId },
  });

  revalidatePath("/dashboard/materiais");
  revalidatePath("/dashboard/despesas");
}

export async function deleteMaterialAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  const { data: material } = await supabase
    .from("materiais")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("materiais")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: autorNome,
      deleted_reason: motivo,
    })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "material",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Material "${material?.nome ?? id}" enviado para a lixeira por ${autorNome}`,
    dadosAntes: material,
    dadosDepois: { deleted: true, motivo },
  });

  revalidatePath("/dashboard/materiais");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lixeira");
}

export async function createFornecedorAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim() || null;
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  const cpf = String(formData.get("cpf") ?? "").trim() || null;
  const chavePix = String(formData.get("chave_pix") ?? "").trim() || null;
  const contaBanco = String(formData.get("conta_banco") ?? "").trim() || null;
  const contaAgencia = String(formData.get("conta_agencia") ?? "").trim() || null;
  const contaNumero = String(formData.get("conta_numero") ?? "").trim() || null;
  if (!nome) return;

  const supabase = await createClient();
  const { data: fornecedor } = await supabase
    .from("fornecedores")
    .insert({
      nome,
      contato,
      cnpj,
      cpf,
      chave_pix: chavePix,
      conta_banco: contaBanco,
      conta_agencia: contaAgencia,
      conta_numero: contaNumero,
    })
    .select("id")
    .single();

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "fornecedor",
    entidadeId: fornecedor?.id,
    origem: "dashboard",
    autorNome,
    resumo: `Fornecedor "${nome}" cadastrado por ${autorNome}`,
    dadosDepois: { nome, contato, cnpj, cpf },
  });

  revalidatePath("/dashboard/fornecedores");
}

export async function updateFornecedorAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const nome = String(formData.get("nome") ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim() || null;
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  const cpf = String(formData.get("cpf") ?? "").trim() || null;
  const chavePix = String(formData.get("chave_pix") ?? "").trim() || null;
  const contaBanco = String(formData.get("conta_banco") ?? "").trim() || null;
  const contaAgencia = String(formData.get("conta_agencia") ?? "").trim() || null;
  const contaNumero = String(formData.get("conta_numero") ?? "").trim() || null;
  if (!nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("fornecedores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = {
    nome,
    contato,
    cnpj,
    cpf,
    chave_pix: chavePix,
    conta_banco: contaBanco,
    conta_agencia: contaAgencia,
    conta_numero: contaNumero,
  };
  await supabase.from("fornecedores").update(depois).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "fornecedor",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Fornecedor "${nome}" editado por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/fornecedores");
  redirect("/dashboard/fornecedores");
}

export async function updateFornecedorModalAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const nome = String(formData.get("nome") ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim() || null;
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  const cpf = String(formData.get("cpf") ?? "").trim() || null;
  const chavePix = String(formData.get("chave_pix") ?? "").trim() || null;
  const contaBanco = String(formData.get("conta_banco") ?? "").trim() || null;
  const contaAgencia = String(formData.get("conta_agencia") ?? "").trim() || null;
  const contaNumero = String(formData.get("conta_numero") ?? "").trim() || null;
  if (!nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("fornecedores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = {
    nome,
    contato,
    cnpj,
    cpf,
    chave_pix: chavePix,
    conta_banco: contaBanco,
    conta_agencia: contaAgencia,
    conta_numero: contaNumero,
  };
  await supabase.from("fornecedores").update(depois).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "fornecedor",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Fornecedor "${nome}" editado por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/fornecedores");
  revalidatePath("/dashboard/despesas");
}

export async function deleteFornecedorAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  const { data: fornecedor } = await supabase
    .from("fornecedores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("fornecedores")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: autorNome,
      deleted_reason: motivo,
    })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "fornecedor",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Fornecedor "${fornecedor?.nome ?? id}" enviado para a lixeira por ${autorNome}`,
    dadosAntes: fornecedor,
    dadosDepois: { deleted: true, motivo },
  });

  revalidatePath("/dashboard/fornecedores");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lixeira");
}

export async function updateDespesaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const valor = parseValorBR(String(formData.get("valor") ?? "0")) ?? 0;
  const etapaId = String(formData.get("etapa_id") ?? "") || null;
  const materialId = String(formData.get("material_id") ?? "") || null;
  const fornecedorId = String(formData.get("fornecedor_id") ?? "") || null;
  const contaBancariaId = String(formData.get("conta_bancaria_id") ?? "") || null;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("despesas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = {
    obra_id: String(formData.get("obra_id") ?? ""),
    categoria_id: String(formData.get("categoria_id") ?? ""),
    etapa_id: etapaId,
    material_id: materialId,
    fornecedor_id: fornecedorId,
    conta_bancaria_id: contaBancariaId,
    valor,
    data: String(formData.get("data") ?? ""),
    descricao: String(formData.get("descricao") ?? "").trim() || null,
  };

  const { error: updateError } = await supabase.from("despesas").update(depois).eq("id", id);
  if (updateError?.message.toLowerCase().includes("conta_bancaria_id")) {
    const { conta_bancaria_id: _contaBancariaIdIgnorado, ...depoisSemContaBancaria } = depois;
    void _contaBancariaIdIgnorado;
    await supabase.from("despesas").update(depoisSemContaBancaria).eq("id", id);
  }

  const autorNome = await getAutorNomeDashboard();
  await anexarArquivosSelecionadosNoFormulario({
    supabase,
    formData,
    despesaId: id,
    autorNome,
  });

  await registrarAtividade({
    tipo: "edicao",
    entidade: "despesa",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Despesa de ${formatBRL(valor)} editada por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
  redirect("/dashboard/despesas");
}

export async function reclassificarComprovanteDespesaAction(
  comprovanteId: string,
  tipoDocumento: string,
  formData: FormData
) {
  const despesaId = String(formData.get("despesa_id") ?? "");

  if (!comprovanteId || !despesaId || !isTipoDocumentoComprovante(tipoDocumento)) {
    return;
  }

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("despesa_comprovantes")
    .select("*")
    .eq("id", comprovanteId)
    .maybeSingle();

  await supabase
    .from("despesa_comprovantes")
    .update({ tipo_documento: tipoDocumento })
    .eq("id", comprovanteId);

  const autorNome = await getAutorNomeDashboard();
  const label =
    tipoDocumento === "comprovante_pagamento"
      ? "comprovante de pagamento"
      : tipoDocumento === "documento_cobranca"
        ? "conta/nota"
        : "outro";

  await registrarAtividade({
    tipo: "edicao",
    entidade: "despesa",
    entidadeId: despesaId,
    origem: "dashboard",
    autorNome,
    resumo: `Comprovante reclassificado como ${label} por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: { tipo_documento: tipoDocumento },
  });

  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard/atividades");
}

export async function excluirComprovanteDespesaAction(
  comprovanteId: string,
  formData: FormData
) {
  const despesaId = String(formData.get("despesa_id") ?? "");
  if (!comprovanteId) return;

  const supabase = await createClient();
  const { data: comprovante } = await supabase
    .from("despesa_comprovantes")
    .select("*")
    .eq("id", comprovanteId)
    .maybeSingle();
  if (!comprovante) return;

  if (comprovante.storage_bucket && comprovante.storage_path) {
    await supabase.storage.from(comprovante.storage_bucket).remove([comprovante.storage_path]);
  }
  await supabase.from("despesa_comprovantes").delete().eq("id", comprovanteId);

  const autorNome = await getAutorNomeDashboard();
  const label =
    comprovante.tipo_documento === "comprovante_pagamento"
      ? "Comprovante de pagamento"
      : comprovante.tipo_documento === "documento_cobranca"
        ? "Conta/nota"
        : "Documento";

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "despesa",
    entidadeId: despesaId || comprovante.despesa_id,
    origem: "dashboard",
    autorNome,
    resumo: `${label} removido do lançamento por ${autorNome} (pode ser reanexado)`,
    dadosAntes: comprovante,
  });

  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard/atividades");
}

export async function anexarComprovanteDespesaAction(formData: FormData) {
  const despesaId = String(formData.get("despesa_id") ?? "");
  const tipoDocumento = String(
    formData.get("anexar_comprovante") ?? formData.get("tipo_documento") ?? ""
  );
  const arquivo =
    formData.get(`arquivo_${tipoDocumento}`) ?? formData.get("arquivo");

  if (
    !despesaId ||
    !isTipoDocumentoComprovante(tipoDocumento) ||
    !(arquivo instanceof File) ||
    arquivo.size === 0
  ) {
    return;
  }

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  await anexarArquivoDespesa({
    supabase,
    despesaId,
    tipoDocumento,
    arquivo,
    autorNome,
  });

  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard/atividades");
}

export async function deleteDespesaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("despesas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("despesas")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: autorNome,
      deleted_reason: motivo,
    })
    .eq("id", id);
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "despesa",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Despesa de ${formatBRL(antes?.valor ?? 0)} excluída por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: { deleted: true, motivo },
  });

  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lixeira");
}

export async function restoreFromTrashAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  if (!id || !isTipoLixeira(tipo)) return;

  const config = LIXEIRA_ENTIDADES[tipo];
  const supabase = await createClient();
  const { data: registro } = await supabase
    .from(config.tabela)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!registro) return;

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from(config.tabela)
    .update({ deleted_at: null, deleted_by: null, deleted_reason: null })
    .eq("id", id);

  await registrarAtividade({
    tipo: "edicao",
    entidade: tipo,
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `${config.nome} restaurado(a) da lixeira por ${autorNome}`,
    dadosAntes: registro,
    dadosDepois: { restored: true },
  });

  revalidatePath(config.rota);
  revalidatePath("/dashboard/lixeira");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/despesas");
}

export async function permanentlyDeleteFromTrashAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  if (!id || !isTipoLixeira(tipo)) return;

  const config = LIXEIRA_ENTIDADES[tipo];
  const supabase = await createClient();
  const { data: registro } = await supabase
    .from(config.tabela)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!registro || !("deleted_at" in registro) || !registro.deleted_at) return;

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: tipo,
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `${config.nome} apagado(a) definitivamente por ${autorNome}`,
    dadosAntes: registro,
    dadosDepois: { permanentlyDeleted: true },
  });

  await supabase.from(config.tabela).delete().eq("id", id);

  revalidatePath(config.rota);
  revalidatePath("/dashboard/lixeira");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/despesas");
}

export async function createNumeroAction(formData: FormData) {
  const telefone = String(formData.get("telefone") ?? "").replace(/\D/g, "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!telefone || !nome) return;

  const supabase = await createClient();
  await supabase.from("usuarios_whatsapp").insert({ telefone, nome });

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "usuario_whatsapp",
    origem: "dashboard",
    autorNome,
    resumo: `Número ${telefone} autorizado para "${nome}" por ${autorNome}`,
    dadosDepois: { telefone, nome },
  });

  revalidatePath("/dashboard/numeros");
}

export async function updateNumeroAction(formData: FormData) {
  const telefone = String(formData.get("telefone") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!telefone || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("usuarios_whatsapp")
    .select("nome")
    .eq("telefone", telefone)
    .maybeSingle();

  await supabase.from("usuarios_whatsapp").update({ nome }).eq("telefone", telefone);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "usuario_whatsapp",
    origem: "dashboard",
    autorNome,
    resumo: `Número ${telefone} renomeado de "${antes?.nome ?? "?"}" para "${nome}" por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: { telefone, nome },
  });

  revalidatePath("/dashboard/numeros");
}

export async function toggleNumeroAtivoAction(formData: FormData) {
  const telefone = String(formData.get("telefone") ?? "");
  const ativo = String(formData.get("ativo") ?? "") === "true";
  if (!telefone) return;

  const supabase = await createClient();
  const { data: usuario } = await supabase
    .from("usuarios_whatsapp")
    .select("nome")
    .eq("telefone", telefone)
    .maybeSingle();

  await supabase
    .from("usuarios_whatsapp")
    .update({ ativo: !ativo })
    .eq("telefone", telefone);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "usuario_whatsapp",
    origem: "dashboard",
    autorNome,
    resumo: `Número ${telefone} (${usuario?.nome ?? "?"}) ${ativo ? "desativado" : "ativado"} por ${autorNome}`,
    dadosAntes: { ativo },
    dadosDepois: { ativo: !ativo },
  });

  revalidatePath("/dashboard/numeros");
}

export async function deleteNumeroAction(formData: FormData) {
  const telefone = String(formData.get("telefone") ?? "");
  if (!telefone) return;

  const supabase = await createClient();
  const { data: usuario } = await supabase
    .from("usuarios_whatsapp")
    .select("*")
    .eq("telefone", telefone)
    .maybeSingle();

  await supabase.from("usuarios_whatsapp").delete().eq("telefone", telefone);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "usuario_whatsapp",
    origem: "dashboard",
    autorNome,
    resumo: `Número ${telefone} (${usuario?.nome ?? "?"}) removido dos acessos por ${autorNome}`,
    dadosAntes: usuario,
  });

  revalidatePath("/dashboard/numeros");
}

export async function updateConfiguracaoNotificacaoAction(formData: FormData) {
  const numeroWhatsapp = String(formData.get("numero_whatsapp") ?? "").replace(/\D/g, "") || null;

  const supabase = await createClient();
  await supabase
    .from("configuracoes_notificacao")
    .update({
      numero_whatsapp: numeroWhatsapp,
      notificar_atraso: formData.get("notificar_atraso") === "on",
      notificar_estouro: formData.get("notificar_estouro") === "on",
      notificar_saldo_negativo: formData.get("notificar_saldo_negativo") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  revalidatePath("/dashboard/configuracoes");
  redirect("/dashboard/configuracoes?salvo=1");
}

export async function testarNotificacaoAction() {
  const resultado = await enviarNotificacaoDiaria();
  revalidatePath("/dashboard/configuracoes");

  if (resultado.enviado) {
    redirect(`/dashboard/configuracoes?teste=enviado&alertas=${resultado.alertas?.length ?? 0}`);
  }
  redirect(`/dashboard/configuracoes?teste=sem_envio&motivo=${encodeURIComponent(resultado.motivo ?? "")}`);
}

export async function enviarRelatorioPdfWhatsAppAction(formData: FormData) {
  const filtros: FiltrosRelatorio = {
    obra: String(formData.get("obra") ?? "") || undefined,
    categoria: String(formData.get("categoria") ?? "") || undefined,
    etapa: String(formData.get("etapa") ?? "") || undefined,
    material: String(formData.get("material") ?? "") || undefined,
    fornecedor: String(formData.get("fornecedor") ?? "") || undefined,
    ids: String(formData.get("ids") ?? "") || undefined,
    dataInicio: String(formData.get("dataInicio") ?? "") || undefined,
    dataFim: String(formData.get("dataFim") ?? "") || undefined,
  };
  const queryString = String(formData.get("query_string") ?? "");
  const voltarPara = `/dashboard/despesas/relatorio${queryString ? `?${queryString}` : ""}`;

  const numero = await numeroNotificacao();
  if (!numero) {
    redirect(`${voltarPara}${queryString ? "&" : "?"}whatsapp=sem_numero`);
  }

  const supabase = await createClient();
  const dados = await buscarDadosRelatorio(filtros);
  const geradoEm = formatDataHoraBrasil(new Date().toISOString());
  const buffer = await gerarRelatorioPdfBuffer(dados, geradoEm);

  const storagePath = `relatorios/${Date.now()}-${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("comprovantes")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    redirect(`${voltarPara}${queryString ? "&" : "?"}whatsapp=erro`);
  }

  const { data: signed } = await supabase.storage
    .from("comprovantes")
    .createSignedUrl(storagePath, 60 * 60 * 24);
  if (!signed?.signedUrl) {
    redirect(`${voltarPara}${queryString ? "&" : "?"}whatsapp=erro`);
  }

  await sendDocument(numero, signed.signedUrl, "relatorio-oryoncash.pdf", "📄 Relatório de despesas — OryonCash");

  redirect(`${voltarPara}${queryString ? "&" : "?"}whatsapp=enviado`);
}

export type ImportarOrcamentoResultado =
  | { ok: true; etapas: number }
  | { ok: false; erro: string };

export async function importarOrcamentoAction(
  formData: FormData
): Promise<ImportarOrcamentoResultado> {
  const obraId = String(formData.get("obra_id") ?? "");
  const arquivo = formData.get("arquivo") as File | null;

  if (!obraId || !arquivo || arquivo.size === 0) {
    return { ok: false, erro: "Selecione uma obra e um arquivo .xlsx." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let texto: string;
  try {
    texto = extractSpreadsheetAsText(buffer);
  } catch {
    return { ok: false, erro: "Não consegui abrir esse arquivo como planilha." };
  }

  const orcamento = await extractOrcamentoData(texto);
  if (!orcamento || orcamento.etapas.length === 0) {
    return {
      ok: false,
      erro:
        "Não consegui identificar as etapas nessa planilha. Confira se ela tem um resumo por etapa com os valores totais.",
    };
  }

  await upsertEtapasDeObra(obraId, orcamento.etapas);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "orcamento",
    entidadeId: obraId,
    origem: "dashboard",
    autorNome,
    resumo: `Orçamento importado (${orcamento.etapas.length} etapas) por ${autorNome}`,
    dadosDepois: { etapas: orcamento.etapas },
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard");

  return { ok: true, etapas: orcamento.etapas.length };
}

// ---------- Módulo de Qualidade ----------

export async function createChecklistTemplateAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  if (!nome) return;

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("checklist_templates")
    .insert({ nome, descricao })
    .select("id")
    .single();

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "categoria",
    entidadeId: template?.id,
    origem: "dashboard",
    autorNome,
    resumo: `Modelo de checklist "${nome}" cadastrado por ${autorNome}`,
    dadosDepois: { nome, descricao },
  });

  revalidatePath("/dashboard/execucao");
}

export async function updateChecklistTemplateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("checklist_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = { nome, descricao };
  await supabase.from("checklist_templates").update(depois).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Modelo de checklist "${nome}" editado por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/execucao");
}

export async function deleteChecklistTemplateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("checklist_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("checklist_templates")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: autorNome,
    })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Modelo de checklist "${template?.nome ?? id}" apagado por ${autorNome}`,
    dadosAntes: template,
  });

  revalidatePath("/dashboard/execucao");
}

export async function createChecklistItemAction(formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  const descricao = String(formData.get("descricao") ?? "").trim();
  const critico = formData.get("critico") === "on";
  const ordem = Number(formData.get("ordem") ?? 0) || 1;
  if (!templateId || !descricao) return;

  const supabase = await createClient();
  await supabase.from("checklist_itens").insert({
    template_id: templateId,
    descricao,
    critico,
    ordem,
  });

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "categoria",
    entidadeId: templateId,
    origem: "dashboard",
    autorNome,
    resumo: `Item de checklist "${descricao}" adicionado por ${autorNome}`,
    dadosDepois: { descricao, critico, ordem },
  });

  revalidatePath("/dashboard/execucao");
}

export async function deleteChecklistItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const templateId = String(formData.get("template_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("checklist_itens")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("checklist_itens").delete().eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "categoria",
    entidadeId: templateId || item?.template_id,
    origem: "dashboard",
    autorNome,
    resumo: `Item de checklist "${item?.descricao ?? id}" apagado por ${autorNome}`,
    dadosAntes: item,
  });

  revalidatePath("/dashboard/execucao");
}

export async function vincularChecklistEtapaAction(formData: FormData) {
  const etapaId = String(formData.get("etapa_id") ?? "");
  const templateId = String(formData.get("checklist_template_id") ?? "") || null;
  const fornecedorId = String(formData.get("fornecedor_id") ?? "") || null;
  if (!etapaId) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("etapas")
    .select("nome, obra_id, checklist_template_id, fornecedor_id")
    .eq("id", etapaId)
    .maybeSingle();

  await supabase
    .from("etapas")
    .update({ checklist_template_id: templateId, fornecedor_id: fornecedorId })
    .eq("id", etapaId);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: antes?.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Checklist/fornecedor vinculado à etapa "${antes?.nome ?? etapaId}" por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: { checklist_template_id: templateId, fornecedor_id: fornecedorId },
  });

  revalidatePath("/dashboard/execucao");
}

async function anexarEvidenciaInspecao(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  inspecaoId: string;
  arquivo: File;
}) {
  const { supabase, inspecaoId, arquivo } = input;
  if (arquivo.size === 0) return;
  validarArquivo(arquivo, MIME_TYPES_IMAGEM_OU_PDF);

  const extensao =
    arquivo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() ||
    arquivo.type.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") ||
    "bin";
  const storagePath = `qualidade/${inspecaoId}/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from("comprovantes")
    .upload(storagePath, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  await supabase.from("inspecao_evidencias").insert({
    inspecao_id: inspecaoId,
    storage_bucket: "comprovantes",
    storage_path: storagePath,
    mime_type: arquivo.type || "application/octet-stream",
    nome_arquivo: arquivo.name,
  });
}

const PESO_RESULTADO: Record<string, number> = {
  reprovado: 3,
  pendente: 2,
  aprovado: 1,
};

export async function iniciarInspecaoAction(formData: FormData) {
  const etapaId = String(formData.get("etapa_id") ?? "");
  const templateId = String(formData.get("template_id") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  const inspecionadoPor = String(formData.get("inspecionado_por") ?? "").trim() || null;
  if (!etapaId || !templateId) return;

  const supabase = await createClient();

  const [{ data: etapa }, { data: itens }] = await Promise.all([
    supabase.from("etapas").select("nome, obra_id").eq("id", etapaId).maybeSingle(),
    supabase
      .from("checklist_itens")
      .select("id, descricao")
      .eq("template_id", templateId)
      .order("ordem"),
  ]);
  if (!itens || itens.length === 0) return;

  type Resposta = "aprovado" | "pendente" | "reprovado" | "nao_aplica";
  const RESPOSTAS_VALIDAS: Resposta[] = ["aprovado", "pendente", "reprovado", "nao_aplica"];
  const respostas = itens.map((item) => {
    const bruto = String(formData.get(`resposta_${item.id}`) ?? "nao_aplica");
    const resposta: Resposta = RESPOSTAS_VALIDAS.includes(bruto as Resposta)
      ? (bruto as Resposta)
      : "nao_aplica";
    return { itemId: item.id, resposta };
  });

  const piorPeso = Math.max(
    ...respostas.map((r) => PESO_RESULTADO[r.resposta] ?? 0)
  );
  const resultado =
    piorPeso === 3 ? "reprovado" : piorPeso === 2 ? "pendente" : "aprovado";

  const { data: inspecao } = await supabase
    .from("inspecoes")
    .insert({
      etapa_id: etapaId,
      template_id: templateId,
      resultado,
      observacao,
      inspecionado_por: inspecionadoPor,
    })
    .select("id")
    .single();
  if (!inspecao) return;

  await supabase.from("inspecao_respostas").insert(
    respostas.map((r) => ({
      inspecao_id: inspecao.id,
      checklist_item_id: r.itemId,
      resposta: r.resposta,
    }))
  );

  for (const arquivo of formData.getAll("evidencia")) {
    if (arquivo instanceof File) {
      await anexarEvidenciaInspecao({ supabase, inspecaoId: inspecao.id, arquivo });
    }
  }

  await supabase
    .from("etapas")
    .update({ situacao_qualidade: resultado })
    .eq("id", etapaId);

  const autorNome = await getAutorNomeDashboard();
  const resultadoLabel =
    resultado === "aprovado"
      ? "aprovada"
      : resultado === "pendente"
        ? "aprovada com pendências"
        : "reprovada";
  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: etapa?.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Inspeção de qualidade da etapa "${etapa?.nome ?? etapaId}" ${resultadoLabel} por ${autorNome}`,
    dadosDepois: { resultado, observacao, respostas },
  });

  revalidatePath("/dashboard/execucao");
}

// ---------- Cronograma e Medições ----------

export async function atualizarProgressoEtapaAction(formData: FormData) {
  const etapaId = String(formData.get("etapa_id") ?? "");
  const dataInicioPrevista = String(formData.get("data_inicio_prevista") ?? "") || null;
  const dataFimPrevista = String(formData.get("data_fim_prevista") ?? "") || null;
  const percentualExecutado = Math.min(
    100,
    Math.max(0, Number(formData.get("percentual_executado") ?? 0))
  );
  if (!etapaId) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("etapas")
    .select("nome, obra_id, data_inicio_prevista, data_fim_prevista, percentual_executado")
    .eq("id", etapaId)
    .maybeSingle();

  const depois = {
    data_inicio_prevista: dataInicioPrevista,
    data_fim_prevista: dataFimPrevista,
    percentual_executado: percentualExecutado,
  };
  await supabase.from("etapas").update(depois).eq("id", etapaId);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: antes?.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Progresso da etapa "${antes?.nome ?? etapaId}" atualizado (${percentualExecutado}%) por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/cronograma");
  revalidatePath("/dashboard/execucao");
}

export async function prepararMedicaoAction(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const categoriaId = String(formData.get("categoria_id") ?? "");
  const periodoInicio = String(formData.get("periodo_inicio") ?? "");
  const periodoFim = String(formData.get("periodo_fim") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  if (!obraId || !categoriaId || !periodoInicio || !periodoFim) return;

  const supabase = await createClient();

  const { data: etapas } = await supabase
    .from("etapas")
    .select("id, nome, valor_orcado, percentual_executado, situacao_qualidade, fornecedor_id")
    .eq("obra_id", obraId)
    .is("deleted_at", null);
  if (!etapas || etapas.length === 0) return;

  const idsEtapas = etapas.map((e) => e.id);
  const { data: itensAnteriores } = await supabase
    .from("medicao_itens")
    .select("etapa_id, percentual_medido")
    .in("etapa_id", idsEtapas);

  const jaMedidoPorEtapa = new Map<string, number>();
  for (const item of itensAnteriores ?? []) {
    jaMedidoPorEtapa.set(
      item.etapa_id,
      (jaMedidoPorEtapa.get(item.etapa_id) ?? 0) + Number(item.percentual_medido)
    );
  }

  const itensElegiveis = calcularItensElegiveisParaMedicao(
    etapas.map((e) => ({
      id: e.id,
      nome: e.nome,
      valorOrcado: Number(e.valor_orcado ?? 0),
      percentualExecutado: Number(e.percentual_executado),
      situacaoQualidade: e.situacao_qualidade,
      fornecedorId: e.fornecedor_id,
    })),
    jaMedidoPorEtapa
  );
  if (itensElegiveis.length === 0) return;

  const valorTotal = itensElegiveis.reduce((soma, item) => soma + item.valorMedido, 0);
  const autorNome = await getAutorNomeDashboard();

  const { data: medicao } = await supabase
    .from("medicoes")
    .insert({
      obra_id: obraId,
      categoria_id: categoriaId,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      observacao,
      valor_total: valorTotal,
      criado_por: autorNome,
    })
    .select("id")
    .single();
  if (!medicao) return;

  await supabase.from("medicao_itens").insert(
    itensElegiveis.map((item) => ({
      medicao_id: medicao.id,
      etapa_id: item.etapaId,
      fornecedor_id: item.fornecedorId,
      percentual_medido: item.percentualMedido,
      valor_medido: item.valorMedido,
    }))
  );

  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: obraId,
    origem: "dashboard",
    autorNome,
    resumo: `Medição preparada (${formatBRL(valorTotal)}, ${itensElegiveis.length} etapa(s)) por ${autorNome}`,
    dadosDepois: { periodoInicio, periodoFim, itens: itensElegiveis },
  });

  revalidatePath("/dashboard/cronograma");
}

export async function updateMedicaoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const categoriaId = String(formData.get("categoria_id") ?? "");
  const periodoInicio = String(formData.get("periodo_inicio") ?? "");
  const periodoFim = String(formData.get("periodo_fim") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  if (!id || !categoriaId || !periodoInicio || !periodoFim) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("medicoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!antes) return;

  const depois = {
    categoria_id: categoriaId,
    periodo_inicio: periodoInicio,
    periodo_fim: periodoFim,
    observacao,
  };
  await supabase.from("medicoes").update(depois).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: antes.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Medição de ${formatBRL(Number(antes.valor_total))} editada por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function apagarMedicaoAction(formData: FormData) {
  const medicaoId = String(formData.get("id") ?? "");
  if (!medicaoId) return;

  const supabase = await createClient();
  const { data: medicao } = await supabase
    .from("medicoes")
    .select("obra_id, status, valor_total")
    .eq("id", medicaoId)
    .maybeSingle();
  if (!medicao) return;

  const autorNome = await getAutorNomeDashboard();
  let despesasEstornadas = 0;

  if (medicao.status === "paga") {
    const { data: itens } = await supabase
      .from("medicao_itens")
      .select("despesa_id")
      .eq("medicao_id", medicaoId);

    for (const item of itens ?? []) {
      if (!item.despesa_id) continue;
      await supabase
        .from("despesas")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: autorNome,
          deleted_reason: "Medição que gerou este lançamento foi apagada",
        })
        .eq("id", item.despesa_id);
      despesasEstornadas += 1;
    }
  }

  await supabase
    .from("medicoes")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: autorNome,
      deleted_reason: "Apagada pelo dashboard",
    })
    .eq("id", medicaoId);

  const statusLabel =
    medicao.status === "paga" ? "paga" : medicao.status === "aprovada" ? "aprovada" : "preparada";
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "medicao",
    entidadeId: medicaoId,
    origem: "dashboard",
    autorNome,
    resumo:
      `Medição ${statusLabel} (${formatBRL(Number(medicao.valor_total))}) apagada por ${autorNome}` +
      (despesasEstornadas > 0
        ? ` — ${despesasEstornadas} despesa(s) gerada(s) enviada(s) para a lixeira`
        : ""),
  });

  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard/lixeira");
  revalidatePath("/dashboard");

  revalidatePath("/dashboard/cronograma");
}

export async function aprovarMedicaoAction(formData: FormData) {
  const medicaoId = String(formData.get("id") ?? "");
  if (!medicaoId) return;

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  const { data: medicao } = await supabase
    .from("medicoes")
    .update({ status: "aprovada", aprovado_por: autorNome, aprovado_em: new Date().toISOString() })
    .eq("id", medicaoId)
    .eq("status", "preparada")
    .select("obra_id, valor_total")
    .maybeSingle();
  if (!medicao) return;

  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: medicao.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Medição de ${formatBRL(Number(medicao.valor_total))} aprovada por ${autorNome}`,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function registrarPagamentoMedicaoAction(formData: FormData) {
  const medicaoId = String(formData.get("id") ?? "");
  if (!medicaoId) return;

  const supabase = await createClient();
  const { data: medicao } = await supabase
    .from("medicoes")
    .select("obra_id, categoria_id, periodo_inicio, periodo_fim, status, valor_total")
    .eq("id", medicaoId)
    .eq("status", "aprovada")
    .maybeSingle();
  if (!medicao) return;

  const { data: itens } = await supabase
    .from("medicao_itens")
    .select("id, etapa_id, fornecedor_id, percentual_medido, valor_medido")
    .eq("medicao_id", medicaoId);
  if (!itens || itens.length === 0) return;

  const { data: etapasNomes } = await supabase
    .from("etapas")
    .select("id, nome")
    .in(
      "id",
      itens.map((i) => i.etapa_id)
    );
  const nomePorEtapa = new Map((etapasNomes ?? []).map((e) => [e.id, e.nome]));

  const autorNome = await getAutorNomeDashboard();
  const periodo = `${medicao.periodo_inicio} a ${medicao.periodo_fim}`;

  for (const item of itens) {
    const nomeEtapa = nomePorEtapa.get(item.etapa_id) ?? "etapa";
    const { data: despesa } = await supabase
      .from("despesas")
      .insert({
        obra_id: medicao.obra_id,
        categoria_id: medicao.categoria_id,
        etapa_id: item.etapa_id,
        fornecedor_id: item.fornecedor_id,
        valor: item.valor_medido,
        descricao: `Medição ${periodo} — ${nomeEtapa} (${item.percentual_medido}% executado)`,
        data: hojeNoBrasil(),
        origem: "dashboard",
      })
      .select("id")
      .single();

    if (despesa) {
      await supabase.from("medicao_itens").update({ despesa_id: despesa.id }).eq("id", item.id);
    }
  }

  await supabase
    .from("medicoes")
    .update({ status: "paga", pago_em: new Date().toISOString() })
    .eq("id", medicaoId);

  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: medicao.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Pagamento de medição registrado (${formatBRL(Number(medicao.valor_total))}, ${itens.length} despesa(s) geradas) por ${autorNome}`,
  });

  revalidatePath("/dashboard/cronograma");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

export async function aprovarEPagarMedicaoAction(formData: FormData) {
  const medicaoId = String(formData.get("id") ?? "");
  if (!medicaoId) return;

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  const { data: medicaoAprovada } = await supabase
    .from("medicoes")
    .update({ status: "aprovada", aprovado_por: autorNome, aprovado_em: new Date().toISOString() })
    .eq("id", medicaoId)
    .eq("status", "preparada")
    .select("obra_id, valor_total")
    .maybeSingle();
  if (!medicaoAprovada) return;

  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: medicaoAprovada.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Medição de ${formatBRL(Number(medicaoAprovada.valor_total))} aprovada por ${autorNome}`,
  });

  const { data: medicao } = await supabase
    .from("medicoes")
    .select("obra_id, categoria_id, periodo_inicio, periodo_fim, status, valor_total")
    .eq("id", medicaoId)
    .eq("status", "aprovada")
    .maybeSingle();
  if (!medicao) return;

  const { data: itens } = await supabase
    .from("medicao_itens")
    .select("id, etapa_id, fornecedor_id, percentual_medido, valor_medido")
    .eq("medicao_id", medicaoId);
  if (!itens || itens.length === 0) return;

  const { data: etapasNomes } = await supabase
    .from("etapas")
    .select("id, nome")
    .in(
      "id",
      itens.map((i) => i.etapa_id)
    );
  const nomePorEtapa = new Map((etapasNomes ?? []).map((e) => [e.id, e.nome]));
  const periodo = `${medicao.periodo_inicio} a ${medicao.periodo_fim}`;

  for (const item of itens) {
    const nomeEtapa = nomePorEtapa.get(item.etapa_id) ?? "etapa";
    const { data: despesa } = await supabase
      .from("despesas")
      .insert({
        obra_id: medicao.obra_id,
        categoria_id: medicao.categoria_id,
        etapa_id: item.etapa_id,
        fornecedor_id: item.fornecedor_id,
        valor: item.valor_medido,
        descricao: `Medição ${periodo} — ${nomeEtapa} (${item.percentual_medido}% executado)`,
        data: hojeNoBrasil(),
        origem: "dashboard",
      })
      .select("id")
      .single();

    if (despesa) {
      await supabase.from("medicao_itens").update({ despesa_id: despesa.id }).eq("id", item.id);
    }
  }

  await supabase
    .from("medicoes")
    .update({ status: "paga", pago_em: new Date().toISOString() })
    .eq("id", medicaoId);

  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: medicao.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Pagamento de medição registrado (${formatBRL(Number(medicao.valor_total))}, ${itens.length} despesa(s) geradas) por ${autorNome}`,
  });

  revalidatePath("/dashboard/execucao");
  revalidatePath("/dashboard/cronograma");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

export async function liberarPagamentoEtapaAction(formData: FormData) {
  const etapaId = String(formData.get("etapa_id") ?? "");
  const categoriaIdInformada = String(formData.get("categoria_id") ?? "") || null;
  if (!etapaId) return;

  const supabase = await createClient();

  const { data: etapa } = await supabase
    .from("etapas")
    .select("id, nome, obra_id, valor_orcado, percentual_executado, situacao_qualidade, fornecedor_id")
    .eq("id", etapaId)
    .maybeSingle();
  if (!etapa || !etapa.obra_id) return;

  const categoriaId =
    categoriaIdInformada ??
    (
      await supabase
        .from("obras")
        .select("categoria_medicao_padrao_id")
        .eq("id", etapa.obra_id)
        .maybeSingle()
    ).data?.categoria_medicao_padrao_id ??
    null;
  if (!categoriaId) return;

  const { data: itensAnteriores } = await supabase
    .from("medicao_itens")
    .select("percentual_medido")
    .eq("etapa_id", etapaId);
  const jaMedido = (itensAnteriores ?? []).reduce(
    (soma, item) => soma + Number(item.percentual_medido),
    0
  );

  const [itemElegivel] = calcularItensElegiveisParaMedicao(
    [
      {
        id: etapa.id,
        nome: etapa.nome,
        valorOrcado: Number(etapa.valor_orcado ?? 0),
        percentualExecutado: Number(etapa.percentual_executado),
        situacaoQualidade: etapa.situacao_qualidade,
        fornecedorId: etapa.fornecedor_id,
      },
    ],
    new Map([[etapa.id, jaMedido]])
  );
  if (!itemElegivel) return;

  const autorNome = await getAutorNomeDashboard();
  const hoje = hojeNoBrasil();

  const { data: medicao } = await supabase
    .from("medicoes")
    .insert({
      obra_id: etapa.obra_id,
      categoria_id: categoriaId,
      periodo_inicio: hoje,
      periodo_fim: hoje,
      status: "paga",
      valor_total: itemElegivel.valorMedido,
      observacao: "Liberação rápida",
      criado_por: autorNome,
      aprovado_por: autorNome,
      aprovado_em: new Date().toISOString(),
      pago_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (!medicao) return;

  const codigoLiberacao = medicao.id.slice(0, 8);

  const { data: medicaoItem } = await supabase
    .from("medicao_itens")
    .insert({
      medicao_id: medicao.id,
      etapa_id: etapa.id,
      fornecedor_id: itemElegivel.fornecedorId,
      percentual_medido: itemElegivel.percentualMedido,
      valor_medido: itemElegivel.valorMedido,
    })
    .select("id")
    .single();

  const { data: despesa } = await supabase
    .from("despesas")
    .insert({
      obra_id: etapa.obra_id,
      categoria_id: categoriaId,
      etapa_id: etapa.id,
      fornecedor_id: itemElegivel.fornecedorId,
      valor: itemElegivel.valorMedido,
      descricao: `Liberação #${codigoLiberacao} — ${etapa.nome} (${itemElegivel.percentualMedido}% executado)`,
      data: hoje,
      origem: "dashboard",
    })
    .select("id")
    .single();

  if (despesa && medicaoItem) {
    await supabase.from("medicao_itens").update({ despesa_id: despesa.id }).eq("id", medicaoItem.id);
  }

  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: etapa.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Liberação #${codigoLiberacao}: pagamento de ${formatBRL(itemElegivel.valorMedido)} liberado para a etapa "${etapa.nome}" (${itemElegivel.percentualMedido}%) por ${autorNome}`,
    dadosDepois: { medicaoId: medicao.id, etapaId: etapa.id, valor: itemElegivel.valorMedido },
  });

  revalidatePath("/dashboard/execucao");
  revalidatePath("/dashboard/cronograma");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

// ---------- Cronograma detalhado (fases + atividades por mês) ----------

function addMesesISO(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + meses, dia));
  return data.toISOString().slice(0, 10);
}

function subtrairDiaISO(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

export async function createCronogramaTemplateAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  if (!nome) return;

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("cronograma_templates")
    .insert({ nome, descricao })
    .select("id")
    .single();

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "categoria",
    entidadeId: template?.id,
    origem: "dashboard",
    autorNome,
    resumo: `Modelo de cronograma "${nome}" cadastrado por ${autorNome}`,
    dadosDepois: { nome, descricao },
  });

  revalidatePath("/dashboard/cronograma");
}

export async function updateCronogramaTemplateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("cronograma_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = { nome, descricao };
  await supabase.from("cronograma_templates").update(depois).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Modelo de cronograma "${nome}" editado por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function deleteCronogramaTemplateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("cronograma_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("cronograma_templates")
    .update({ deleted_at: new Date().toISOString(), deleted_by: autorNome })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Modelo de cronograma "${template?.nome ?? id}" apagado por ${autorNome}`,
    dadosAntes: template,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function createFaseTemplateAction(formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const mesInicio = Number(formData.get("mes_inicio") ?? 0) || 1;
  const duracaoMeses = Number(formData.get("duracao_meses") ?? 0) || 1;
  const ordem = Number(formData.get("ordem") ?? 0) || 1;
  if (!templateId || !nome) return;

  const supabase = await createClient();
  await supabase.from("cronograma_template_fases").insert({
    template_id: templateId,
    nome,
    ordem,
    mes_inicio: mesInicio,
    duracao_meses: duracaoMeses,
  });

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "categoria",
    entidadeId: templateId,
    origem: "dashboard",
    autorNome,
    resumo: `Fase "${nome}" adicionada ao modelo de cronograma por ${autorNome}`,
    dadosDepois: { nome, mesInicio, duracaoMeses, ordem },
  });

  revalidatePath("/dashboard/cronograma");
}

export async function deleteFaseTemplateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const templateId = String(formData.get("template_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: fase } = await supabase
    .from("cronograma_template_fases")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("cronograma_template_fases").delete().eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "categoria",
    entidadeId: templateId || fase?.template_id,
    origem: "dashboard",
    autorNome,
    resumo: `Fase "${fase?.nome ?? id}" apagada do modelo de cronograma por ${autorNome}`,
    dadosAntes: fase,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function createAtividadeTemplateAction(formData: FormData) {
  const faseId = String(formData.get("fase_id") ?? "");
  const templateId = String(formData.get("template_id") ?? "");
  const descricao = String(formData.get("descricao") ?? "").trim();
  const ordem = Number(formData.get("ordem") ?? 0) || 1;
  if (!faseId || !descricao) return;

  const supabase = await createClient();
  await supabase.from("cronograma_template_atividades").insert({
    fase_id: faseId,
    descricao,
    ordem,
  });

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "categoria",
    entidadeId: templateId || faseId,
    origem: "dashboard",
    autorNome,
    resumo: `Atividade "${descricao}" adicionada ao modelo de cronograma por ${autorNome}`,
    dadosDepois: { descricao, ordem },
  });

  revalidatePath("/dashboard/cronograma");
}

export async function deleteAtividadeTemplateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const templateId = String(formData.get("template_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: atividade } = await supabase
    .from("cronograma_template_atividades")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("cronograma_template_atividades").delete().eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "categoria",
    entidadeId: templateId,
    origem: "dashboard",
    autorNome,
    resumo: `Atividade "${atividade?.descricao ?? id}" apagada do modelo de cronograma por ${autorNome}`,
    dadosAntes: atividade,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function aplicarCronogramaTemplateAction(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const templateId = String(formData.get("template_id") ?? "");
  if (!obraId || !templateId) return;

  const supabase = await createClient();

  const { count: fasesExistentes } = await supabase
    .from("obra_cronograma_fases")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId);
  if ((fasesExistentes ?? 0) > 0) return;

  const [{ data: obra }, { data: fasesTemplate }] = await Promise.all([
    supabase.from("obras").select("data_inicio").eq("id", obraId).maybeSingle(),
    supabase
      .from("cronograma_template_fases")
      .select(
        "id, nome, ordem, mes_inicio, duracao_meses, cronograma_template_atividades(id, descricao, ordem)"
      )
      .eq("template_id", templateId)
      .order("ordem"),
  ]);
  if (!fasesTemplate || fasesTemplate.length === 0) return;

  const dataInicioObra = obra?.data_inicio ?? hojeNoBrasil();
  const autorNome = await getAutorNomeDashboard();

  let totalAtividades = 0;
  for (const fase of fasesTemplate) {
    const dataInicioFase = addMesesISO(dataInicioObra, fase.mes_inicio - 1);
    const dataFimExclusiva = addMesesISO(dataInicioFase, fase.duracao_meses);
    const dataFimFase = subtrairDiaISO(dataFimExclusiva);

    const { data: faseObra } = await supabase
      .from("obra_cronograma_fases")
      .insert({
        obra_id: obraId,
        nome: fase.nome,
        ordem: fase.ordem,
        data_inicio_prevista: dataInicioFase,
        data_fim_prevista: dataFimFase,
      })
      .select("id")
      .single();
    if (!faseObra) continue;

    const atividades = [...(fase.cronograma_template_atividades ?? [])].sort(
      (a, b) => a.ordem - b.ordem
    );
    if (atividades.length > 0) {
      await supabase.from("obra_cronograma_atividades").insert(
        atividades.map((a) => ({
          fase_id: faseObra.id,
          descricao: a.descricao,
          ordem: a.ordem,
        }))
      );
      totalAtividades += atividades.length;
    }
  }

  const { data: template } = await supabase
    .from("cronograma_templates")
    .select("nome")
    .eq("id", templateId)
    .maybeSingle();

  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: obraId,
    origem: "dashboard",
    autorNome,
    resumo: `Cronograma aplicado a partir do modelo "${template?.nome ?? templateId}" (${fasesTemplate.length} fase(s), ${totalAtividades} atividade(s)) por ${autorNome}`,
    dadosDepois: { templateId, fases: fasesTemplate.length, atividades: totalAtividades },
  });

  revalidatePath("/dashboard/cronograma");
}

export async function removerCronogramaObraAction(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  if (!obraId) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("obra_cronograma_fases")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId);
  if (!count) return;

  await supabase.from("obra_cronograma_fases").delete().eq("obra_id", obraId);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "obra",
    entidadeId: obraId,
    origem: "dashboard",
    autorNome,
    resumo: `Cronograma detalhado removido da obra por ${autorNome}`,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function atualizarStatusAtividadeAction(formData: FormData) {
  const atividadeId = String(formData.get("atividade_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!atividadeId || !["a_fazer", "em_andamento", "concluida"].includes(status)) return;

  const supabase = await createClient();
  await supabase
    .from("obra_cronograma_atividades")
    .update({
      status: status as "a_fazer" | "em_andamento" | "concluida",
      concluida_em: status === "concluida" ? new Date().toISOString() : null,
    })
    .eq("id", atividadeId);

  revalidatePath("/dashboard/cronograma");
}

// ---------- Contratos de fornecedor ----------

export async function createContratoFornecedorAction(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const fornecedorId = String(formData.get("fornecedor_id") ?? "");
  const etapaId = String(formData.get("etapa_id") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const valorContrato = parseValorBR(String(formData.get("valor_contrato") ?? "0")) ?? 0;
  if (!obraId || !fornecedorId) return;

  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contratos_fornecedor")
    .insert({
      obra_id: obraId,
      fornecedor_id: fornecedorId,
      etapa_id: etapaId,
      descricao,
      valor_contrato: valorContrato,
    })
    .select("id")
    .single();

  const arquivo = formData.get("arquivo");
  if (contrato && arquivo instanceof File && arquivo.size > 0) {
    await anexarArquivoContrato({ supabase, contratoId: contrato.id, arquivo });
  }

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: obraId,
    origem: "dashboard",
    autorNome,
    resumo: `Contrato de fornecedor cadastrado (${formatBRL(valorContrato)}) por ${autorNome}`,
    dadosDepois: { id: contrato?.id, fornecedorId, etapaId, descricao, valorContrato },
  });

  revalidatePath("/dashboard/cronograma");
}

export async function updateContratoFornecedorAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const fornecedorId = String(formData.get("fornecedor_id") ?? "");
  const etapaId = String(formData.get("etapa_id") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const valorContrato = parseValorBR(String(formData.get("valor_contrato") ?? "0")) ?? 0;
  if (!id || !fornecedorId) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("contratos_fornecedor")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = { fornecedor_id: fornecedorId, etapa_id: etapaId, descricao, valor_contrato: valorContrato };
  await supabase.from("contratos_fornecedor").update(depois).eq("id", id);

  const arquivo = formData.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    if (antes?.arquivo_storage_path) {
      await supabase.storage.from("comprovantes").remove([antes.arquivo_storage_path]);
    }
    await anexarArquivoContrato({ supabase, contratoId: id, arquivo });
  }

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "obra",
    entidadeId: antes?.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Contrato de fornecedor editado (${formatBRL(valorContrato)}) por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/cronograma");
}

export async function deleteContratoFornecedorAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contratos_fornecedor")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!contrato) return;

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("contratos_fornecedor")
    .update({ deleted_at: new Date().toISOString(), deleted_by: autorNome })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "obra",
    entidadeId: contrato.obra_id,
    origem: "dashboard",
    autorNome,
    resumo: `Contrato de fornecedor (${formatBRL(Number(contrato.valor_contrato))}) apagado por ${autorNome}`,
    dadosAntes: contrato,
  });

  revalidatePath("/dashboard/cronograma");
}

// ---------- Contas bancárias ----------

export async function createContaBancariaAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const banco = String(formData.get("banco") ?? "").trim() || null;
  const agencia = String(formData.get("agencia") ?? "").trim() || null;
  const numero = String(formData.get("numero") ?? "").trim() || null;
  const titular = String(formData.get("titular") ?? "").trim() || null;
  const documento = String(formData.get("documento") ?? "").trim() || null;
  const saldoInicial = parseValorBR(String(formData.get("saldo_inicial") ?? "0")) ?? 0;
  if (!nome) return;

  const supabase = await createClient();
  const dados = { nome, banco, agencia, numero, titular, documento, saldo_inicial: saldoInicial };
  let { data: conta, error } = await supabase.from("contas_bancarias").insert(dados).select("id").single();
  if (error?.message.toLowerCase().includes("titular") || error?.message.toLowerCase().includes("documento")) {
    ({ data: conta } = await supabase
      .from("contas_bancarias")
      .insert({ nome, banco, agencia, numero, saldo_inicial: saldoInicial })
      .select("id")
      .single());
  }

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "criacao",
    entidade: "categoria",
    entidadeId: conta?.id,
    origem: "dashboard",
    autorNome,
    resumo: `Conta bancária "${nome}" cadastrada por ${autorNome}`,
    dadosDepois: { nome, banco, agencia, numero, titular, documento, saldoInicial },
  });

  revalidatePath("/dashboard/contas");
}

export async function updateContaBancariaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const banco = String(formData.get("banco") ?? "").trim() || null;
  const agencia = String(formData.get("agencia") ?? "").trim() || null;
  const numero = String(formData.get("numero") ?? "").trim() || null;
  const titular = String(formData.get("titular") ?? "").trim() || null;
  const documento = String(formData.get("documento") ?? "").trim() || null;
  const saldoInicial = parseValorBR(String(formData.get("saldo_inicial") ?? "0")) ?? 0;
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = { nome, banco, agencia, numero, titular, documento, saldo_inicial: saldoInicial };
  const { error: updateError } = await supabase.from("contas_bancarias").update(depois).eq("id", id);
  if (
    updateError?.message.toLowerCase().includes("titular") ||
    updateError?.message.toLowerCase().includes("documento")
  ) {
    const { titular: _t, documento: _d, ...depoisSemNovosCampos } = depois;
    void _t;
    void _d;
    await supabase.from("contas_bancarias").update(depoisSemNovosCampos).eq("id", id);
  }

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Conta bancária "${nome}" editada por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: depois,
  });

  revalidatePath("/dashboard/contas");
  revalidatePath("/dashboard/despesas");
}

export async function deleteContaBancariaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!conta) return;

  const autorNome = await getAutorNomeDashboard();
  await supabase
    .from("contas_bancarias")
    .update({ deleted_at: new Date().toISOString(), deleted_by: autorNome })
    .eq("id", id);

  await registrarAtividade({
    tipo: "exclusao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Conta bancária "${conta.nome}" apagada por ${autorNome}`,
    dadosAntes: conta,
  });

  revalidatePath("/dashboard/contas");
  revalidatePath("/dashboard/despesas");
}
