/**
 * Usuarios do Telegram entram no sistema como um "telefone" com prefixo
 * (tg_123456789), pra reaproveitar tudo que ja e chaveado por telefone:
 * sessao da conversa, autorizacao (usuarios_whatsapp), rate limit, autoria.
 * Usa "_" e nao ":" porque o id vira parte de caminho de arquivo no Storage.
 */
export const PREFIXO_TELEGRAM = "tg_";

export function ehTelegram(destino: string): boolean {
  return destino.startsWith(PREFIXO_TELEGRAM);
}

export function chatIdDe(destino: string): string {
  return destino.slice(PREFIXO_TELEGRAM.length);
}

export function destinoTelegram(chatId: number | string): string {
  return `${PREFIXO_TELEGRAM}${chatId}`;
}

/** Ids extras (env TELEGRAM_NOTIFY_IDS="123,456") que recebem avisos se o WhatsApp falhar. */
export function idsTelegramParaAvisos(): string[] {
  return (process.env.TELEGRAM_NOTIFY_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));
}
