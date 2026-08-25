"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, parseValorBR } from "@/lib/conversation/format";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { registrarAtividade } from "@/lib/atividades";
import { getAutorNomeDashboard } from "@/app/dashboard/actions";
import { processarExtrato } from "@/lib/conciliacao/queries";

const TAMANHO_MAXIMO_ARQUIVO_BYTES = 15 * 1024 * 1024;
const MIME_TYPES_EXTRATO = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function validarArquivoExtrato(arquivo: File) {
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
    throw new Error(
      `Arquivo "${arquivo.name}" tem ${(arquivo.size / (1024 * 1024)).toFixed(1)}MB - o limite é 15MB.`
    );
  }
  if (arquivo.type && !MIME_TYPES_EXTRATO.has(arquivo.type)) {
    throw new Error(`Tipo de arquivo "${arquivo.type || "desconhecido"}" não é aceito para o extrato.`);
  }
}

export async function uploadExtratoAction(formData: FormData) {
  const contaBancariaId = String(formData.get("conta_bancaria_id") ?? "") || null;
  const periodoInicio = String(formData.get("periodo_inicio") ?? "") || null;
  const periodoFim = String(formData.get("periodo_fim") ?? "") || null;
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    console.error("Upload de extrato sem arquivo.");
    return;
  }

  try {
    validarArquivoExtrato(arquivo);
  } catch (error) {
    console.error("Arquivo de extrato inválido:", error);
    return;
  }

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  const extensao =
    arquivo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() ||
    arquivo.type.split("/")[1]?.replace("jpeg", "jpg") ||
    "bin";
  const storagePath = `extratos/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from("comprovantes")
    .upload(storagePath, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    console.error("Falha ao enviar arquivo de extrato:", uploadError);
    return;
  }

  const { data: extrato, error: insertError } = await supabase
    .from("extratos_bancarios")
    .insert({
      conta_bancaria_id: contaBancariaId,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      storage_bucket: "comprovantes",
      storage_path: storagePath,
      nome_arquivo: arquivo.name,
      created_by: autorNome,
    })
    .select("id")
    .single();
  if (insertError || !extrato) {
    console.error("Falha ao registrar extrato:", insertError);
    return;
  }

  try {
    await processarExtrato(extrato.id);
  } catch (error) {
    console.error("Falha ao processar extrato bancário:", error);
  }

  await registrarAtividade({
    tipo: "criacao",
    entidade: "extrato_bancario",
    entidadeId: extrato.id,
    origem: "dashboard",
    autorNome,
    resumo: `Extrato bancário enviado por ${autorNome} para conciliação`,
  });

  revalidatePath("/dashboard/conciliacao");
  redirect(`/dashboard/conciliacao/${extrato.id}`);
}

export async function excluirExtratoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: extrato } = await supabase
    .from("extratos_bancarios")
    .select("storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("extrato_transacoes").delete().eq("extrato_id", id);
  await supabase.from("extratos_bancarios").delete().eq("id", id);

  if (extrato) {
    await supabase.storage.from(extrato.storage_bucket).remove([extrato.storage_path]);
  }

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "extrato_bancario",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Extrato bancário excluído por ${autorNome}`,
  });

  revalidatePath("/dashboard/conciliacao");
}

export async function vincularTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const despesaId = String(formData.get("despesa_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!transacaoId || !despesaId) return;

  const supabase = await createClient();
  await supabase
    .from("extrato_transacoes")
    .update({ despesa_id: despesaId, status: "conciliado" })
    .eq("id", transacaoId);

  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
}

export async function desvincularTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!transacaoId) return;

  const supabase = await createClient();
  await supabase
    .from("extrato_transacoes")
    .update({ despesa_id: null, status: "pendente" })
    .eq("id", transacaoId);

  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
}

export async function ignorarTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!transacaoId) return;

  const supabase = await createClient();
  await supabase
    .from("extrato_transacoes")
    .update({ status: "ignorado", despesa_id: null })
    .eq("id", transacaoId);

  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
}

export async function criarDespesaDaTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  const contaBancariaId = String(formData.get("conta_bancaria_id") ?? "") || null;
  const obraId = String(formData.get("obra_id") ?? "");
  const categoriaId = String(formData.get("categoria_id") ?? "");
  const valor = parseValorBR(String(formData.get("valor") ?? "0")) ?? 0;
  const data = String(formData.get("data") ?? "") || hojeNoBrasil();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;

  if (!transacaoId || !obraId || !categoriaId || valor <= 0) return;

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  const depois = {
    obra_id: obraId,
    categoria_id: categoriaId,
    conta_bancaria_id: contaBancariaId,
    valor,
    data,
    descricao,
    origem: "dashboard" as const,
  };

  const { data: despesa, error } = await supabase.from("despesas").insert(depois).select("id").single();
  if (error || !despesa) return;

  await registrarAtividade({
    tipo: "criacao",
    entidade: "despesa",
    entidadeId: despesa.id,
    origem: "dashboard",
    autorNome,
    resumo: `Despesa de ${formatBRL(valor)} lançada por ${autorNome} a partir da conciliação bancária`,
    dadosDepois: depois,
  });

  await supabase
    .from("extrato_transacoes")
    .update({ despesa_id: despesa.id, status: "conciliado" })
    .eq("id", transacaoId);

  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
  revalidatePath("/dashboard/despesas");
}

async function atualizarTotaisExtrato(extratoId: string) {
  if (!extratoId) return;
  const supabase = await createClient();
  const { count: total } = await supabase
    .from("extrato_transacoes")
    .select("id", { count: "exact", head: true })
    .eq("extrato_id", extratoId);
  const { count: conciliadas } = await supabase
    .from("extrato_transacoes")
    .select("id", { count: "exact", head: true })
    .eq("extrato_id", extratoId)
    .eq("status", "conciliado");

  await supabase
    .from("extratos_bancarios")
    .update({ total_transacoes: total ?? 0, total_conciliadas: conciliadas ?? 0 })
    .eq("id", extratoId);
}
