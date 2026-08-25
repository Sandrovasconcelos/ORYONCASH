"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseValorBR } from "@/lib/conversation/format";
import { registrarAtividade } from "@/lib/atividades";
import { getAutorNomeDashboard } from "@/app/dashboard/actions";
import { marcarContaAPagarComoPaga, type Recorrencia } from "@/lib/contasAPagar/queries";

const TAMANHO_MAXIMO_ARQUIVO_BYTES = 15 * 1024 * 1024;
const MIME_TYPES_ARQUIVO = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function isRecorrencia(valor: string): valor is Recorrencia {
  return valor === "nenhuma" || valor === "semanal" || valor === "mensal";
}

async function uploadArquivo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  prefixo: string,
  arquivo: File
): Promise<{ bucket: string; path: string; mimeType: string; nomeArquivo: string } | null> {
  if (arquivo.size === 0) return null;
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
    console.error(`Arquivo "${arquivo.name}" excede 15MB.`);
    return null;
  }
  if (arquivo.type && !MIME_TYPES_ARQUIVO.has(arquivo.type)) {
    console.error(`Tipo de arquivo "${arquivo.type}" não aceito.`);
    return null;
  }

  const extensao =
    arquivo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() ||
    arquivo.type.split("/")[1]?.replace("jpeg", "jpg") ||
    "bin";
  const path = `${prefixo}/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage.from("comprovantes").upload(path, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    console.error("Falha ao enviar arquivo:", error);
    return null;
  }

  return { bucket: "comprovantes", path, mimeType: arquivo.type || "application/octet-stream", nomeArquivo: arquivo.name };
}

export async function criarContaAPagarAction(formData: FormData) {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valor = parseValorBR(String(formData.get("valor") ?? "0")) ?? 0;
  const dataVencimento = String(formData.get("data_vencimento") ?? "");
  const recorrenciaRaw = String(formData.get("recorrencia") ?? "nenhuma");
  const recorrencia = isRecorrencia(recorrenciaRaw) ? recorrenciaRaw : "nenhuma";
  const avisarDiasAntes = Number(formData.get("avisar_dias_antes") ?? 3) || 3;
  const categoriaId = String(formData.get("categoria_id") ?? "") || null;
  const obraId = String(formData.get("obra_id") ?? "") || null;
  const fornecedorId = String(formData.get("fornecedor_id") ?? "") || null;

  if (!descricao || valor <= 0 || !dataVencimento) return;

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  const arquivo = formData.get("arquivo");
  const arquivoEnviado = arquivo instanceof File ? await uploadArquivo(supabase, "contas-a-pagar", arquivo) : null;

  const { data: conta, error } = await supabase
    .from("contas_a_pagar")
    .insert({
      descricao,
      valor,
      categoria_id: categoriaId,
      obra_id: obraId,
      fornecedor_id: fornecedorId,
      data_vencimento: dataVencimento,
      recorrencia,
      avisar_dias_antes: avisarDiasAntes,
      storage_bucket: arquivoEnviado?.bucket ?? null,
      storage_path: arquivoEnviado?.path ?? null,
      nome_arquivo: arquivoEnviado?.nomeArquivo ?? null,
      created_by: autorNome,
    })
    .select("id")
    .single();

  if (error || !conta) {
    console.error("Falha ao criar conta a pagar:", error);
    return;
  }

  await registrarAtividade({
    tipo: "criacao",
    entidade: "conta_a_pagar",
    entidadeId: conta.id,
    origem: "dashboard",
    autorNome,
    resumo: `Conta a pagar "${descricao}" (${valor}) cadastrada por ${autorNome}`,
  });

  revalidatePath("/dashboard/contas-a-pagar");
}

export async function marcarContaAPagarComoPagaAction(formData: FormData) {
  const contaId = String(formData.get("conta_id") ?? "");
  if (!contaId) return;

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  const arquivo = formData.get("arquivo");
  const comprovante = arquivo instanceof File ? await uploadArquivo(supabase, "contas-a-pagar-comprovantes", arquivo) : null;

  const resultado = await marcarContaAPagarComoPaga({
    contaId,
    comprovante: comprovante
      ? { bucket: comprovante.bucket, path: comprovante.path, mimeType: comprovante.mimeType, nomeArquivo: comprovante.nomeArquivo }
      : null,
    autorNome,
  });

  if (!resultado) {
    console.error("Falha ao marcar conta a pagar como paga.");
    return;
  }

  await registrarAtividade({
    tipo: "edicao",
    entidade: "conta_a_pagar",
    entidadeId: contaId,
    origem: "dashboard",
    autorNome,
    resumo: `Conta a pagar marcada como paga por ${autorNome}`,
    dadosDepois: resultado,
  });

  revalidatePath("/dashboard/contas-a-pagar");
  revalidatePath("/dashboard/despesas");
}

export async function excluirContaAPagarAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: conta } = await supabase
    .from("contas_a_pagar")
    .select("storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("contas_a_pagar").delete().eq("id", id);

  if (conta?.storage_bucket && conta.storage_path) {
    await supabase.storage.from(conta.storage_bucket).remove([conta.storage_path]);
  }

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "conta_a_pagar",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Conta a pagar excluída por ${autorNome}`,
  });

  revalidatePath("/dashboard/contas-a-pagar");
}

export async function cancelarContaAPagarAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("contas_a_pagar").update({ status: "cancelado" }).eq("id", id);

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "edicao",
    entidade: "conta_a_pagar",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Conta a pagar cancelada por ${autorNome}`,
  });

  revalidatePath("/dashboard/contas-a-pagar");
}
