/**
 * A coluna `origem` so distingue "whatsapp" (qualquer mensagem de bot) de
 * "dashboard". Lancamentos vindos do Telegram tem o autor gravado como
 * tg_<id>, entao o rotulo mostrado ao usuario sai dai - sem migration e
 * valendo tambem pros lancamentos ja feitos.
 */
export function rotuloOrigem(
  origem: string | null | undefined,
  autorTelefone: string | null | undefined
): string {
  if (autorTelefone?.startsWith("tg_")) return "Telegram";
  if (origem === "whatsapp") return "WhatsApp";
  if (origem === "dashboard") return "Dashboard";
  return origem ?? "Sistema";
}
