"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, parseValorBR } from "@/lib/conversation/format";
import { upsertEtapasDeObra } from "@/lib/conversation/queries";
import { extractSpreadsheetAsText } from "@/lib/orcamento/parseSpreadsheet";
import { extractOrcamentoData } from "@/lib/gemini/extractOrcamento";
import { registrarAtividade } from "@/lib/atividades";

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


async function anexarArquivoDespesa(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  despesaId: string;
  tipoDocumento: TipoDocumentoComprovante;
  arquivo: File;
  autorNome: string;
}) {
  const { supabase, despesaId, tipoDocumento, arquivo, autorNome } = input;

  if (arquivo.size === 0) return;

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
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("obras")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = { nome, orcamento_total: orcamentoTotal, status };
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

export async function deleteEtapaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  let obraId = String(formData.get("obra_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const [{ data: etapa }, { count: despesasCount }] = await Promise.all([
    supabase.from("etapas").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("despesas")
      .select("id", { count: "exact", head: true })
      .eq("etapa_id", id),
  ]);

  obraId = obraId || etapa?.obra_id || "";
  if ((despesasCount ?? 0) > 0) return;

  await supabase.from("etapas").delete().eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "obra",
    entidadeId: obraId,
    origem: "dashboard",
    autorNome,
    resumo: `Etapa "${etapa?.nome ?? id}" apagada por ${autorNome}`,
    dadosAntes: etapa,
  });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard/despesas");
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
  if (!nome) return;

  const supabase = await createClient();
  const { data: categoria } = await supabase
    .from("categorias")
    .insert({ nome })
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
    dadosDepois: { nome },
  });

  revalidatePath("/dashboard/categorias");
  revalidatePath("/dashboard/materiais");
  revalidatePath("/dashboard/despesas");
  revalidatePath("/dashboard");
}

export async function updateCategoriaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("categorias")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("categorias").update({ nome }).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "categoria",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Categoria "${nome}" editada por ${autorNome}`,
    dadosAntes: antes,
    dadosDepois: { nome },
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
  if (!nome) return;

  const supabase = await createClient();
  const { data: fornecedor } = await supabase
    .from("fornecedores")
    .insert({ nome, contato })
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
    dadosDepois: { nome, contato },
  });

  revalidatePath("/dashboard/fornecedores");
}

export async function updateFornecedorAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const nome = String(formData.get("nome") ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim() || null;
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  if (!nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("fornecedores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = { nome, contato, cnpj };
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
  if (!nome) return;

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("fornecedores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const depois = { nome, contato, cnpj };
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
    valor,
    data: String(formData.get("data") ?? ""),
    descricao: String(formData.get("descricao") ?? "").trim() || null,
  };

  await supabase.from("despesas").update(depois).eq("id", id);

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

export async function reclassificarComprovanteDespesaAction(formData: FormData) {
  const [id, tipoDocumento] = String(formData.get("reclassificar_comprovante") ?? "").split("|");
  const despesaId = String(formData.get("despesa_id") ?? "");

  if (
    !id ||
    !despesaId ||
    !isTipoDocumentoComprovante(tipoDocumento)
  ) {
    return;
  }

  const supabase = await createClient();
  const { data: antes } = await supabase
    .from("despesa_comprovantes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("despesa_comprovantes")
    .update({ tipo_documento: tipoDocumento })
    .eq("id", id);

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

export async function toggleNumeroAtivoAction(formData: FormData) {
  const telefone = String(formData.get("telefone") ?? "");
  const ativo = String(formData.get("ativo") ?? "") === "true";
  if (!telefone) return;

  const supabase = await createClient();
  await supabase
    .from("usuarios_whatsapp")
    .update({ ativo: !ativo })
    .eq("telefone", telefone);

  revalidatePath("/dashboard/numeros");
}

export async function deleteNumeroAction(formData: FormData) {
  const telefone = String(formData.get("telefone") ?? "");
  if (!telefone) return;

  const supabase = await createClient();
  await supabase.from("usuarios_whatsapp").delete().eq("telefone", telefone);

  revalidatePath("/dashboard/numeros");
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
