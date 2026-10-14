"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AreaArquivo } from "@/lib/arquivos/tipos";
import { extensaoDoArquivo, nomeSeguro } from "@/lib/arquivos/nomes";
import { caminhoNoDrive } from "@/lib/arquivos/pastaNoDrive";
import { aplicarDestino, destinoDoFormulario, mesmoLocal, nomeDaCopia, type DestinoParcial, type LocalDoArquivo } from "@/lib/arquivos/destino";
import { apagarNoDrive, BUCKET_DRIVE, copiarNoDrive, moverNoDrive } from "@/lib/google/drive";

const BUCKET = "comprovantes";

async function usuarioLogado(): Promise<string | null> {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  return user?.email ?? null;
}

type LinhaDoArquivo = {
  id: string;
  nome: string;
  area: AreaArquivo;
  obra_id: string | null;
  pasta: string | null;
  tipo: string;
  descricao: string | null;
  texto_busca: string | null;
  nome_arquivo: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  validade: string | null;
  avisar_dias_antes: number;
};

async function carregarObrasParaDestino() {
  const { data } = await createAdminClient().from("obras").select("id, nome").is("deleted_at", null);
  const nomes = new Map((data ?? []).map((o) => [o.id, o.nome]));
  return { ids: new Set(nomes.keys()), nomes };
}

function pastaNomeDoLocal(local: LocalDoArquivo, nomes: Map<string, string>): string | null {
  return local.area === "obra" ? (local.obra_id ? (nomes.get(local.obra_id) ?? null) : local.pasta) : local.pasta;
}

const localDe = (a: LinhaDoArquivo): LocalDoArquivo => ({ area: a.area, obra_id: a.obra_id, pasta: a.pasta, tipo: a.tipo });

async function carregarArquivosPorIds(ids: string[]): Promise<LinhaDoArquivo[]> {
  if (ids.length === 0) return [];
  const { data } = await createAdminClient().from("arquivos").select("*").in("id", ids.slice(0, 500));
  return (data ?? []) as LinhaDoArquivo[];
}

function idsDoFormulario(formData: FormData): string[] {
  return String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function destinoDosCampos(formData: FormData): DestinoParcial {
  return destinoDoFormulario({
    area: String(formData.get("area") ?? ""),
    obra_id: String(formData.get("obra_id") ?? ""),
    pasta: String(formData.get("pasta") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
  });
}

async function moverCore(ids: string[], destino: DestinoParcial): Promise<number> {
  const arquivos = await carregarArquivosPorIds(ids);
  if (arquivos.length === 0) return 0;
  const obras = await carregarObrasParaDestino();
  const supabase = await createClient();
  let movidos = 0;
  for (const a of arquivos) {
    const novo = aplicarDestino(localDe(a), destino, obras.ids);
    if (mesmoLocal(localDe(a), novo)) continue;
    const { error } = await supabase.from("arquivos").update({ ...novo, updated_at: new Date().toISOString() }).eq("id", a.id);
    if (error) {
      console.error("Erro ao mover arquivo:", error.message);
      continue;
    }
    movidos += 1;
    if (a.storage_bucket === BUCKET_DRIVE) {
      await moverNoDrive(a.storage_path, caminhoNoDrive({ area: novo.area, pastaNome: pastaNomeDoLocal(novo, obras.nomes), tipo: novo.tipo })).catch((e) =>
        console.error("Erro ao mover no Drive:", e)
      );
    }
  }
  revalidatePath("/dashboard/arquivos");
  return movidos;
}

/** "Mover para..." (formulario com area, obra/pasta e tipo). */
export async function moverArquivosAction(formData: FormData) {
  if (!(await usuarioLogado())) return;
  await moverCore(idsDoFormulario(formData), destinoDosCampos(formData));
}

/** Arrastar e soltar: move os arquivos pra pasta/tipo onde foram soltos. */
export async function moverPorArrasteAction(ids: string[], destino: DestinoParcial): Promise<{ movidos: number }> {
  if (!(await usuarioLogado())) return { movidos: 0 };
  return { movidos: await moverCore(ids, destino) };
}

/** "Copiar para...": duplica o registro (e o arquivo, no Drive ou no Storage) no destino. */
export async function copiarArquivosAction(formData: FormData) {
  const autor = await usuarioLogado();
  if (!autor) return;
  const arquivos = await carregarArquivosPorIds(idsDoFormulario(formData));
  if (arquivos.length === 0) return;
  const destino = destinoDosCampos(formData);
  const obras = await carregarObrasParaDestino();
  const supabase = await createClient();
  const admin = createAdminClient();

  for (const a of arquivos) {
    const novo = aplicarDestino(localDe(a), destino, obras.ids);
    const igual = mesmoLocal(localDe(a), novo);
    const nome = nomeDaCopia(a.nome, igual);
    const nomeNoDrive = a.nome_arquivo ?? `${nomeSeguro(nome)}.${extensaoDoArquivo(a.mime_type, a.nome_arquivo)}`;
    try {
      let bucket = a.storage_bucket;
      let path: string;
      if (a.storage_bucket === BUCKET_DRIVE) {
        path = await copiarNoDrive(a.storage_path, caminhoNoDrive({ area: novo.area, pastaNome: pastaNomeDoLocal(novo, obras.nomes), tipo: novo.tipo }), nomeNoDrive);
      } else {
        bucket = BUCKET;
        path = `arquivos/${new Date().getFullYear()}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(nome, 40)}.${extensaoDoArquivo(a.mime_type, a.nome_arquivo)}`;
        const { error: erroCopia } = await admin.storage.from(a.storage_bucket).copy(a.storage_path, path, { destinationBucket: BUCKET });
        if (erroCopia) throw new Error(erroCopia.message);
      }
      const { error } = await supabase.from("arquivos").insert({
        ...novo,
        nome,
        descricao: a.descricao,
        texto_busca: a.texto_busca,
        nome_arquivo: a.nome_arquivo,
        storage_bucket: bucket,
        storage_path: path,
        mime_type: a.mime_type,
        tamanho_bytes: a.tamanho_bytes,
        validade: a.validade,
        avisar_dias_antes: a.avisar_dias_antes,
        origem: "dashboard",
        enviado_por: autor,
      });
      if (error) throw new Error(error.message);
    } catch (error) {
      console.error("Erro ao copiar arquivo:", error);
    }
  }
  revalidatePath("/dashboard/arquivos");
}

/** Renomeia direto na lista (clique no nome). */
export async function renomearArquivoAction(id: string, nome: string): Promise<{ ok: boolean }> {
  if (!(await usuarioLogado())) return { ok: false };
  const limpo = nome.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!id || !limpo) return { ok: false };
  const { error } = await (await createClient()).from("arquivos").update({ nome: limpo, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false };
  revalidatePath("/dashboard/arquivos");
  return { ok: true };
}

/** Exclui varios de uma vez (Drive: vai pra lixeira do Drive). */
export async function excluirVariosAction(formData: FormData) {
  if (!(await usuarioLogado())) return;
  const arquivos = await carregarArquivosPorIds(idsDoFormulario(formData));
  if (arquivos.length === 0) return;
  await (await createClient()).from("arquivos").delete().in("id", arquivos.map((a) => a.id));
  for (const a of arquivos) {
    if (a.storage_bucket === BUCKET_DRIVE) {
      await apagarNoDrive(a.storage_path).catch((e) => console.error("Erro ao apagar no Drive:", e));
    } else if (a.storage_path.startsWith("arquivos/")) {
      await createAdminClient().storage.from(a.storage_bucket).remove([a.storage_path]);
    }
  }
  revalidatePath("/dashboard/arquivos");
}
