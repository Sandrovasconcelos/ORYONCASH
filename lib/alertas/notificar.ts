import { createAdminClient } from "@/lib/supabase/admin";
import { buscarAlertas, type Alerta } from "@/lib/alertas/queries";
import { buscarResumoPeriodo } from "@/lib/alertas/resumos";
import {
  formatarMensagemAlertas,
  formatarNotificacaoLancamento,
  formatarResumoDiario,
  formatarResumoSemanal,
} from "@/lib/whatsapp/notificacoes";
import { sendText } from "@/lib/whatsapp/messages";

// Duplicado de lib/conversation/queries.ts (nao importado de la) pra evitar
// import circular: queries.ts chama notificarLancamento deste arquivo.
function hojeNoBrasil(): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const ano = partes.find((p) => p.type === "year")?.value;
  const mes = partes.find((p) => p.type === "month")?.value;
  const dia = partes.find((p) => p.type === "day")?.value;
  if (!ano || !mes || !dia) return new Date().toISOString().slice(0, 10);
  return `${ano}-${mes}-${dia}`;
}

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

function subtrairDiasISO(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

function formatarDataBRCurta(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function numeroNotificacao(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: config } = await supabase
    .from("configuracoes_notificacao")
    .select("numero_whatsapp")
    .eq("id", true)
    .maybeSingle();
  return config?.numero_whatsapp ?? null;
}

/** Roda todo dia às 22h (Brasília) — resumo do dia por conta e por obra/etapa. Manda sempre, mesmo sem lançamento. */
export async function enviarResumoDiario(): Promise<{ enviado: boolean; motivo?: string }> {
  const numero = await numeroNotificacao();
  if (!numero) return { enviado: false, motivo: "Nenhum número de WhatsApp configurado para notificações." };

  const hoje = hojeNoBrasil();
  const resumo = await buscarResumoPeriodo(hoje, hoje);
  const mensagem = formatarResumoDiario(formatarDataBRCurta(hoje), resumo);

  await sendText(numero, mensagem);
  return { enviado: true };
}

/** Roda toda segunda-feira às 7h (Brasília) — fecha a semana anterior (segunda a domingo). */
export async function enviarResumoSemanal(): Promise<{ enviado: boolean; motivo?: string }> {
  const numero = await numeroNotificacao();
  if (!numero) return { enviado: false, motivo: "Nenhum número de WhatsApp configurado para notificações." };

  const hoje = hojeNoBrasil();
  const inicioSemana = subtrairDiasISO(hoje, 7);
  const fimSemana = subtrairDiasISO(hoje, 1);
  const resumo = await buscarResumoPeriodo(inicioSemana, fimSemana);
  const periodoLabel = `${formatarDataBRCurta(inicioSemana)} a ${formatarDataBRCurta(fimSemana)}`;
  const mensagem = formatarResumoSemanal(periodoLabel, resumo);

  await sendText(numero, mensagem);
  return { enviado: true };
}

/**
 * Chamada toda vez que uma despesa e criada pelo WhatsApp (lib/conversation/queries.ts,
 * createDespesa). So notifica quando quem lancou nao e o proprio numero
 * configurado pra receber notificacoes - evita avisar voce de algo que voce
 * acabou de fazer e ja viu confirmado na hora.
 */
export async function notificarLancamento(input: {
  valor: number;
  categoriaId: string;
  obraId: string;
  autorTelefone: string | null;
  autorNome: string | null;
}): Promise<void> {
  const numero = await numeroNotificacao();
  if (!numero) return;
  if (input.autorTelefone && input.autorTelefone === numero) return;

  const supabase = createAdminClient();
  const [{ data: categoria }, { data: obra }] = await Promise.all([
    supabase.from("categorias").select("nome").eq("id", input.categoriaId).maybeSingle(),
    supabase.from("obras").select("nome").eq("id", input.obraId).maybeSingle(),
  ]);

  const mensagem = formatarNotificacaoLancamento({
    valor: input.valor,
    categoriaNome: categoria?.nome ?? "Sem categoria",
    obraNome: obra?.nome ?? null,
    autorNome: input.autorNome,
  });
  await sendText(numero, mensagem);
}
