"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehArea, normalizarTipo, type AreaArquivo } from "@/lib/arquivos/tipos";
import { extensaoDoArquivo, nomeSeguro } from "@/lib/arquivos/nomes";
import { lerValidade } from "@/lib/arquivos/validade";

const BUCKET = "comprovantes";
const TAMANHO_MAXIMO_BYTES = 100 * 1024 * 1024;

async function usuarioLogado(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/**
 * Passo 1 do envio pelo painel: gera um endereco de upload direto pro
 * Storage (o arquivo nao passa pelo servidor - assim PDFs e projetos grandes
 * nao esbarram no limite de corpo da Vercel).
 */
export async function prepararUploadArquivoAction(
  nomeArquivo: string,
  mimeType: string,
  tamanho: number
): Promise<{ path: string; token: string } | { erro: string }> {
  if (!(await usuarioLogado())) return { erro: "Sessão expirada. Entre de novo." };
  if (tamanho > TAMANHO_MAXIMO_BYTES) return { erro: "O arquivo passa de 100 MB." };

  const ano = new Date().getFullYear();
  const path = `arquivos/${ano}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(nomeArquivo, 40)}.${extensaoDoArquivo(mimeType, nomeArquivo)}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { erro: "Não consegui preparar o envio. Tente de novo." };
  return { path, token: data.token };
}

type CamposDoArquivo = {
  area: AreaArquivo;
  obra_id: string | null;
  pasta: string | null;
  tipo: string;
  nome: string;
  descricao: string | null;
  validade: string | null;
  avisar_dias_antes: number;
};

function lerCampos(formData: FormData): CamposDoArquivo | null {
  const area = String(formData.get("area") ?? "obra");
  if (!ehArea(area)) return null;
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 120);
  if (!nome) return null;

  const validadeBruta = String(formData.get("validade") ?? "").trim();
  let validade: string | null = null;
  if (validadeBruta) {
    const lida = lerValidade(validadeBruta);
    if (!lida.ok) return null;
    validade = lida.data;
  }
  const avisar = Math.min(Math.max(Math.round(Number(formData.get("avisar_dias_antes") ?? 30)) || 30, 0), 365);
  const obraId = String(formData.get("obra_id") ?? "").trim();
  const pasta = String(formData.get("pasta") ?? "").trim().slice(0, 80);

  return {
    area,
    obra_id: area === "obra" ? obraId || null : null,
    pasta: area === "obra" ? null : pasta || null,
    tipo: normalizarTipo(String(formData.get("tipo") ?? "")),
    nome,
    descricao: String(formData.get("descricao") ?? "").trim().slice(0, 300) || null,
    validade,
    avisar_dias_antes: avisar,
  };
}

/** Passo 2 do envio: o arquivo ja esta no Storage; registra na biblioteca. */
export async function registrarArquivoAction(formData: FormData): Promise<{ ok: true } | { erro: string }> {
  const autor = await usuarioLogado();
  if (!autor) return { erro: "Sessão expirada. Entre de novo." };

  const campos = lerCampos(formData);
  if (!campos) return { erro: "Confira o nome e a validade (ex: 14/03/2027)." };
  const path = String(formData.get("storage_path") ?? "");
  if (!path.startsWith("arquivos/")) return { erro: "Arquivo inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("arquivos").insert({
    ...campos,
    nome_arquivo: String(formData.get("nome_arquivo") ?? "") || null,
    storage_bucket: BUCKET,
    storage_path: path,
    mime_type: String(formData.get("mime_type") ?? "") || null,
    tamanho_bytes: Number(formData.get("tamanho_bytes") ?? 0) || null,
    origem: "dashboard",
    enviado_por: autor,
  });
  if (error) {
    console.error("Erro ao registrar arquivo:", error.message);
    return { erro: "Não consegui salvar o arquivo." };
  }
  revalidatePath("/dashboard/arquivos");
  return { ok: true };
}

export async function atualizarArquivoAction(formData: FormData) {
  if (!(await usuarioLogado())) return;
  const id = String(formData.get("id") ?? "");
  const campos = lerCampos(formData);
  if (!id || !campos) return;

  const supabase = await createClient();
  const { data: antes } = await supabase.from("arquivos").select("validade, avisar_dias_antes").eq("id", id).maybeSingle();
  // Prazo novo = os avisos recomecam.
  const prazoMudou = antes && (antes.validade !== campos.validade || antes.avisar_dias_antes !== campos.avisar_dias_antes);

  const { error } = await supabase
    .from("arquivos")
    .update({
      ...campos,
      updated_at: new Date().toISOString(),
      ...(prazoMudou ? { aviso_antecipado_em: null, aviso_vencimento_em: null } : {}),
    })
    .eq("id", id);
  if (error) console.error("Erro ao atualizar arquivo:", error.message);
  revalidatePath("/dashboard/arquivos");
}

export async function excluirArquivoAction(formData: FormData) {
  if (!(await usuarioLogado())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: arquivo } = await supabase.from("arquivos").select("storage_bucket, storage_path").eq("id", id).maybeSingle();
  await supabase.from("arquivos").delete().eq("id", id);
  // So apaga do Storage o que a biblioteca criou.
  if (arquivo?.storage_path.startsWith("arquivos/")) {
    await createAdminClient().storage.from(arquivo.storage_bucket).remove([arquivo.storage_path]);
  }
  revalidatePath("/dashboard/arquivos");
}
