import { createAdminClient } from "@/lib/supabase/admin";

// Evita ler o banco a cada aviso (varios avisos saem em sequencia).
const VALIDADE_MS = 60_000;
let cache: { valor: boolean; ate: number } | null = null;

/**
 * Verdadeiro quando o monitor de saude marcou o WhatsApp como fora do ar
 * (ex: conta banida pela Meta). Nesse caso os avisos automaticos vao direto
 * pro Telegram, sem gastar uma tentativa que ja se sabe que falha. Qualquer
 * erro na leitura conta como "nao sei" (false): tenta o WhatsApp como antes.
 */
export async function whatsappForaDoAr(): Promise<boolean> {
  const agora = Date.now();
  if (cache && cache.ate > agora) return cache.valor;
  let valor = false;
  try {
    const { data, error } = await createAdminClient()
      .from("saude_canais")
      .select("ok")
      .eq("canal", "WhatsApp")
      .maybeSingle();
    valor = !error && data?.ok === false;
  } catch {
    valor = false;
  }
  cache = { valor, ate: agora + VALIDADE_MS };
  return valor;
}

export function limparCacheCanalForaDoAr() {
  cache = null;
}
