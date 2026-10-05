import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacao, numeroNotificacao } from "@/lib/alertas/notificar";
import { extrairEventosMeta, mensagemDeAviso } from "./eventosMeta";

/**
 * Guarda os avisos da Meta (ban, revisao, alertas, falhas graves de envio)
 * e avisa o dono pelo canal que estiver no ar. Nunca lanca: o webhook tem
 * que responder 200 de qualquer jeito.
 */
export async function registrarEventosMeta(payload: unknown): Promise<void> {
  try {
    const eventos = extrairEventosMeta(payload);
    if (eventos.length === 0) return;

    console.error("Aviso da Meta no webhook:", JSON.stringify(eventos.map((e) => ({ campo: e.campo, evento: e.evento, resumo: e.resumo }))));

    try {
      const { error } = await createAdminClient()
        .from("eventos_meta")
        .insert(
          eventos.map((e) => ({
            campo: e.campo,
            evento: e.evento,
            resumo: e.resumo,
            importante: e.importante,
            payload: e.payload as never,
          }))
        );
      if (error) console.error("Nao consegui gravar eventos_meta (migration aplicada?):", error.message);
    } catch (e) {
      console.error("Falha ao gravar eventos_meta:", e);
    }

    const importantes = eventos.filter((e) => e.importante);
    if (importantes.length > 0) {
      Sentry.captureMessage(`Aviso da Meta: ${importantes.map((e) => `${e.campo}/${e.evento}`).join(", ")}`, "warning");
      const numero = await numeroNotificacao();
      if (numero) await enviarNotificacao(numero, mensagemDeAviso(importantes));
    }
  } catch (error) {
    console.error("Erro ao registrar eventos da Meta:", error);
  }
}
