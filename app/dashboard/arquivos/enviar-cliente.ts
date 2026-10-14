import { createClient } from "@/lib/supabase/client";
import type { CamposDeEnvio } from "@/lib/arquivos/destino";
import { prepararUploadArquivoAction, registrarArquivoAction } from "./actions";

export type { CamposDeEnvio };

export type ExtrasDoEnvio = { nome?: string; validade?: string; avisar?: number; descricao?: string };

/**
 * Envia um arquivo do computador pra biblioteca: direto do navegador pro Drive
 * (ou Storage), e depois registra. Usado pelo "arrastar do computador pra tela",
 * pelo "soltar em cima de uma pasta" e pelo envio de varios arquivos de uma vez.
 */
export async function enviarArquivoParaBiblioteca(
  file: File,
  campos: CamposDeEnvio,
  extras: ExtrasDoEnvio = {}
): Promise<{ ok: true } | { erro: string }> {
  const preparo = await prepararUploadArquivoAction(file.name, file.type, file.size, campos);
  if ("erro" in preparo) return { erro: preparo.erro };

  const dados = new FormData();
  if (preparo.modo === "drive") {
    try {
      const res = await fetch(preparo.url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      const corpo = res.ok ? ((await res.json()) as { id?: string }) : null;
      if (!corpo?.id) return { erro: "O Google Drive não aceitou o envio." };
      dados.set("drive_file_id", corpo.id);
    } catch {
      return { erro: "Falha ao enviar pro Google Drive." };
    }
  } else {
    const { error } = await createClient()
      .storage.from("comprovantes")
      .uploadToSignedUrl(preparo.path, preparo.token, file, { contentType: file.type || "application/octet-stream" });
    if (error) return { erro: "Falha ao enviar o arquivo." };
    dados.set("storage_path", preparo.path);
  }

  dados.set("area", campos.area);
  dados.set("obra_id", campos.obraId);
  dados.set("pasta", campos.pasta);
  dados.set("tipo", campos.tipo);
  dados.set("nome", extras.nome?.trim() || file.name.replace(/\.[^.]+$/, "") || file.name);
  dados.set("validade", extras.validade ?? "");
  dados.set("avisar_dias_antes", String(extras.avisar ?? 30));
  dados.set("descricao", extras.descricao ?? "");
  dados.set("nome_arquivo", file.name);
  dados.set("mime_type", file.type);
  dados.set("tamanho_bytes", String(file.size));

  const resultado = await registrarArquivoAction(dados);
  return "erro" in resultado ? { erro: resultado.erro } : { ok: true };
}
