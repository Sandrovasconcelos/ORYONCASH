const EXTENSAO_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/gif": "gif",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/3gpp": "3gp",
  "text/plain": "txt",
  "image/vnd.dwg": "dwg",
  "application/acad": "dwg",
  "application/x-dwg": "dwg",
};

export function extensaoDoArquivo(mimeType: string | null | undefined, nomeArquivo?: string | null): string {
  const doNome = nomeArquivo?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (doNome) return doNome;
  const mime = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  return EXTENSAO_POR_MIME[mime] ?? mime.split("/")[1]?.replace(/[^a-z0-9]/g, "").slice(0, 5) ?? "bin";
}

/** "Alvará de construção" -> "alvara-de-construcao" (seguro pra caminho de Storage e nome de arquivo). */
export function nomeSeguro(texto: string, tamanhoMaximo = 70): string {
  const limpo = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, tamanhoMaximo);
  return limpo || "arquivo";
}

export function formatarTamanho(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Tipos que o navegador abre direto (PDF e imagem); o resto so baixa. */
export function abreNoNavegador(mimeType: string | null | undefined): boolean {
  const m = (mimeType ?? "").toLowerCase();
  return m === "application/pdf" || m.startsWith("image/");
}

/**
 * Nome com que o arquivo e entregue (WhatsApp, Telegram, painel): o original
 * que a pessoa enviou; se nao houver, o titulo do documento com a extensao certa.
 */
export function nomeParaDownload(a: { nome: string; nome_arquivo: string | null; mime_type: string | null }): string {
  const original = a.nome_arquivo?.replace(/[\\/:*?"<>|]+/g, "-").trim();
  if (original) return original;
  return `${nomeSeguro(a.nome)}.${extensaoDoArquivo(a.mime_type, a.nome_arquivo)}`;
}

const FUSO_BRASIL = "America/Fortaleza";

/** "13/10/2026 às 17:56" (horario de Brasilia) - quando o arquivo foi guardado. */
export function formatarArquivadoEm(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { timeZone: FUSO_BRASIL });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO_BRASIL, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${data} às ${hora}`;
}
