import { createAdminClient } from "@/lib/supabase/admin";
import { buscarAlertas, type Alerta } from "@/lib/alertas/queries";
import { formatarMensagemAlertas } from "@/lib/whatsapp/notificacoes";
import { sendText } from "@/lib/whatsapp/messages";

/**
 * Usada tanto pelo cron diario (app/api/cron/notificacoes/route.ts) quanto
 * pelo botao "Testar agora" da tela de Configuracoes, pra nao duplicar a
 * logica de filtrar pelos toggles + formatar + enviar.
 */
export async function enviarNotificacaoDiaria(): Promise<{
  enviado: boolean;
  motivo?: string;
  alertas?: Alerta[];
}> {
  const supabase = createAdminClient();
  const { data: config } = await supabase
    .from("configuracoes_notificacao")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (!config?.numero_whatsapp) {
    return { enviado: false, motivo: "Nenhum número de WhatsApp configurado para notificações." };
  }

  const todosAlertas = await buscarAlertas();
  const alertasFiltrados = todosAlertas.filter((a: Alerta) => {
    if (a.tipo === "etapa_atrasada") return config.notificar_atraso;
    if (a.tipo === "orcamento_estourado") return config.notificar_estouro;
    return config.notificar_saldo_negativo;
  });

  const mensagem = formatarMensagemAlertas(alertasFiltrados);
  if (!mensagem) {
    return { enviado: false, motivo: "Nada a reportar hoje.", alertas: [] };
  }

  await sendText(config.numero_whatsapp, mensagem);
  return { enviado: true, alertas: alertasFiltrados };
}
