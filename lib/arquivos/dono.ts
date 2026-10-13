import { numeroNotificacao } from "@/lib/alertas/notificar";
import { destinoTelegram, ehTelegram, idsTelegramParaAvisos } from "@/lib/telegram/ids";

/** Compara dois numeros de WhatsApp ignorando o 9 extra depois do DDD (55 85 9 8888-7777 x 55 85 8888-7777). */
export function mesmoNumero(a: string, b: string): boolean {
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (!da || !db) return false;
  if (da === db) return true;
  const sem9 = (n: string) => (n.startsWith("55") && n.length === 13 && n[4] === "9" ? n.slice(0, 4) + n.slice(5) : n);
  return sem9(da) === sem9(db);
}

/**
 * A biblioteca de arquivos e so do dono: o numero configurado em Notificacoes
 * (e o Telegram de avisos). Outras pessoas autorizadas seguem so com o fluxo
 * de contas e despesas.
 */
export async function ehDonoDosArquivos(from: string): Promise<boolean> {
  const dono = await numeroNotificacao();
  if (ehTelegram(from)) {
    return idsTelegramParaAvisos().map(destinoTelegram).includes(from) || dono === from;
  }
  return Boolean(dono) && !ehTelegram(dono as string) && mesmoNumero(dono as string, from);
}
