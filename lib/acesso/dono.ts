import { createAdminClient } from "@/lib/supabase/admin";
import { ehTelegram } from "@/lib/telegram/ids";

/** Compara dois numeros de WhatsApp ignorando o 9 extra depois do DDD (55 85 9 8888-7777 x 55 85 8888-7777). */
export function mesmoNumero(a: string, b: string): boolean {
  if (ehTelegram(a) || ehTelegram(b)) return a === b;
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (!da || !db) return false;
  if (da === db) return true;
  const sem9 = (n: string) => (n.startsWith("55") && n.length === 13 && n[4] === "9" ? n.slice(0, 4) + n.slice(5) : n);
  return sem9(da) === sem9(db);
}

/**
 * Funcoes pessoais do Sandro (agenda e biblioteca de arquivos) so valem pra
 * quem esta marcado como "dono" em usuarios_whatsapp (WhatsApp e Telegram).
 * Os demais usuarios (ex: Leo) ficam so com o financeiro do OryonCash.
 * Sem a coluna (migration nao aplicada) ou sem ninguem marcado: ninguem e dono.
 */
export async function ehDono(from: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("usuarios_whatsapp").select("telefone").eq("ativo", true).eq("dono", true);
  if (error) {
    console.error("Erro ao checar dono:", error.message);
    return false;
  }
  return (data ?? []).some((u) => mesmoNumero(u.telefone, from));
}
