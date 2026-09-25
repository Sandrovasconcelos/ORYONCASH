import { fetchComTimeout } from "@/lib/fetchComTimeout";

const TIMEOUT_MS = 15_000;

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN nao configurado");
  return t;
}

type RespostaTelegram<T> = { ok: boolean; result?: T; description?: string };

/**
 * As mensagens de erro nunca incluem a URL (ela carrega o token do bot).
 */
export async function telegramCall<T = unknown>(
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetchComTimeout(
    `https://api.telegram.org/bot${token()}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    TIMEOUT_MS
  );
  const json = (await res.json().catch(() => null)) as RespostaTelegram<T> | null;
  if (!res.ok || !json?.ok) {
    throw new Error(
      `Falha ao chamar o Telegram (${method}, ${res.status}): ${json?.description ?? "sem detalhe"}`
    );
  }
  return json.result as T;
}

/** Envia um arquivo em bytes (multipart) - necessario pra escolher o nome do arquivo. */
export async function telegramUpload(
  method: string,
  campos: Record<string, string>,
  campoArquivo: { nome: string; arquivo: Blob; filename: string }
): Promise<void> {
  const form = new FormData();
  for (const [chave, valor] of Object.entries(campos)) form.append(chave, valor);
  form.append(campoArquivo.nome, campoArquivo.arquivo, campoArquivo.filename);

  const res = await fetchComTimeout(
    `https://api.telegram.org/bot${token()}/${method}`,
    { method: "POST", body: form },
    30_000
  );
  const json = (await res.json().catch(() => null)) as RespostaTelegram<unknown> | null;
  if (!res.ok || !json?.ok) {
    throw new Error(
      `Falha ao enviar arquivo ao Telegram (${method}, ${res.status}): ${json?.description ?? "sem detalhe"}`
    );
  }
}

/** Baixa um arquivo recebido pelo bot (limite do Telegram: 20 MB). */
export async function baixarArquivoTelegram(fileId: string): Promise<Buffer> {
  const info = await telegramCall<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!info.file_path) throw new Error("Telegram nao devolveu o caminho do arquivo");

  const res = await fetchComTimeout(
    `https://api.telegram.org/file/bot${token()}/${info.file_path}`,
    {},
    TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Falha ao baixar arquivo do Telegram (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
