import { createAdminClient } from "@/lib/supabase/admin";

const JANELA_MS = 60_000;
const LIMITE_POR_JANELA = 20;

/**
 * Limite simples por numero de telefone (janela deslizante de 1 minuto,
 * guardada no Postgres pra sobreviver entre invocacoes serverless). Nao e
 * atomico (le-depois-escreve), mas serve como camada extra de defesa
 * contra loop de bug ou abuso - nunca deve travar o bot de verdade, entao
 * qualquer erro (inclusive migration ainda nao aplicada) libera a
 * mensagem em vez de bloquear.
 */
export async function excedeuLimiteDeTaxa(telefone: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const agora = Date.now();

    const { data: registro } = await supabase
      .from("webhook_rate_limit")
      .select("contador, janela_inicio")
      .eq("telefone", telefone)
      .maybeSingle();

    const janelaExpirada =
      !registro || agora - new Date(registro.janela_inicio).getTime() > JANELA_MS;

    if (janelaExpirada) {
      await supabase
        .from("webhook_rate_limit")
        .upsert({ telefone, contador: 1, janela_inicio: new Date(agora).toISOString() });
      return false;
    }

    if (registro.contador >= LIMITE_POR_JANELA) {
      return true;
    }

    await supabase
      .from("webhook_rate_limit")
      .update({ contador: registro.contador + 1 })
      .eq("telefone", telefone);
    return false;
  } catch {
    return false;
  }
}
