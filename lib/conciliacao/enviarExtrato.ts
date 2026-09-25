import { createAdminClient } from "@/lib/supabase/admin";
import { processarExtrato } from "@/lib/conciliacao/queries";

export const MIME_TYPES_EXTRATO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function listarContasBancarias() {
  const { data } = await createAdminClient()
    .from("contas_bancarias")
    .select("id, nome")
    .is("deleted_at", null)
    .order("nome");
  return data ?? [];
}

/**
 * Mesmo caminho do upload do dashboard, mas a partir de um arquivo recebido
 * pelo bot: guarda no Storage, registra o extrato, le com o Gemini e concilia.
 */
export async function registrarEEProcessarExtrato(input: {
  buffer: Buffer;
  mimeType: string;
  contaBancariaId: string;
  autorNome: string;
}): Promise<{
  extratoId: string;
  totalTransacoes: number;
  totalConciliadas: number;
  ignoradas: number;
}> {
  const supabase = createAdminClient();
  const extensao = input.mimeType.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "pdf";
  const storagePath = `extratos/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from("comprovantes")
    .upload(storagePath, input.buffer, { contentType: input.mimeType, upsert: false });
  if (erroUpload) throw erroUpload;

  const { data: extrato, error: erroInsert } = await supabase
    .from("extratos_bancarios")
    .insert({
      conta_bancaria_id: input.contaBancariaId,
      storage_bucket: "comprovantes",
      storage_path: storagePath,
      nome_arquivo: `extrato-telegram-${new Date().toISOString().slice(0, 10)}.${extensao}`,
      created_by: input.autorNome,
    })
    .select("id")
    .single();
  if (erroInsert || !extrato) throw erroInsert ?? new Error("Falha ao registrar o extrato.");

  await processarExtrato(extrato.id);

  const [{ data: resumo }, { count: ignoradas }] = await Promise.all([
    supabase.from("extratos_bancarios").select("total_transacoes, total_conciliadas").eq("id", extrato.id).single(),
    supabase
      .from("extrato_transacoes")
      .select("id", { count: "exact", head: true })
      .eq("extrato_id", extrato.id)
      .eq("status", "ignorado"),
  ]);

  return {
    extratoId: extrato.id,
    totalTransacoes: resumo?.total_transacoes ?? 0,
    totalConciliadas: resumo?.total_conciliadas ?? 0,
    ignoradas: ignoradas ?? 0,
  };
}
