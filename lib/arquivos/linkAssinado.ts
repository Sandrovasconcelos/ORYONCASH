import { createHmac, timingSafeEqual } from "node:crypto";

const VALIDADE_PADRAO_S = 60 * 60 * 24;

function chave(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? process.env.CRON_SECRET ?? "";
}

function assinar(id: string, exp: number): string {
  return createHmac("sha256", chave()).update(`${id}.${exp}`).digest("base64url");
}

/** Link temporario (so pra quem recebe: WhatsApp/Telegram) que baixa um arquivo do Drive pelo servidor. */
export function linkDeDownload(origem: string, id: string, validadeS = VALIDADE_PADRAO_S): string {
  const exp = Math.floor(Date.now() / 1000) + validadeS;
  return `${origem}/api/arquivos/${id}/baixar?exp=${exp}&sig=${assinar(id, exp)}`;
}

export function linkValido(id: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig || !chave()) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  const esperado = Buffer.from(assinar(id, expNum));
  const recebido = Buffer.from(sig);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
