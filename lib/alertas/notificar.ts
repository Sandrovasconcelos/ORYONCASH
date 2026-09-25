import { createAdminClient } from "@/lib/supabase/admin";
import { buscarAlertas, type Alerta } from "@/lib/alertas/queries";
import { buscarResumoPeriodo } from "@/lib/alertas/resumos";
import {
  formatarMensagemAlertas,
  formatarNotificacaoLancamento,
  formatarNotificacaoComprovantePagamento,
  formatarResumoDiario,
  formatarResumoSemanal,
} from "@/lib/whatsapp/notificacoes";
import { sendText } from "@/lib/whatsapp/messages";
import { sendTelegramTextComBotoes } from "@/lib/telegram/messages";
import { TECLADO_RESUMO, botaoDashboard, type Teclado } from "@/lib/telegram/interativo";
import { destinoTelegram, ehTelegram, idsTelegramParaAvisos } from "@/lib/telegram/ids";

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

  const [primeiroTelegram] = idsTelegramParaAvisos();
  const destino = config?.numero_whatsapp || (primeiroTelegram ? destinoTelegram(primeiroTelegram) : null);
  if (!config || !destino) {
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

  await enviarNotificacao(destino, mensagem, { botoes: [[botaoDashboard()]] });
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

export async function numeroNotificacao(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: config } = await supabase
    .from("configuracoes_notificacao")
    .select("numero_whatsapp")
    .eq("id", true)
    .maybeSingle();
  if (config?.numero_whatsapp) return config.numero_whatsapp;

  // Sem numero configurado mas com Telegram de avisos (TELEGRAM_NOTIFY_IDS):
  // os avisos seguem funcionando so por la.
  const [primeiroTelegram] = idsTelegramParaAvisos();
  return primeiroTelegram ? destinoTelegram(primeiroTelegram) : null;
}

/**
 * Envia um aviso pro numero configurado; se o envio falhar (ex: conta do
 * WhatsApp bloqueada) ou o destino ja for Telegram, entrega tambem nos ids
 * de TELEGRAM_NOTIFY_IDS - assim um canal fora do ar nao deixa o dono sem
 * saber de nada.
 */
export async function enviarNotificacao(
  numero: string,
  mensagem: string,
  opcoes: { botoes?: Teclado } = {}
): Promise<void> {
  const extras = idsTelegramParaAvisos().map(destinoTelegram);
  const destinosTelegram = ehTelegram(numero) ? [numero, ...extras] : extras;

  // Telegram recebe os botoes; WhatsApp so texto (os botoes de URL viram link).
  const enviarPara = (destino: string) => {
    if (ehTelegram(destino)) {
      return opcoes.botoes
        ? sendTelegramTextComBotoes(destino, mensagem, opcoes.botoes)
        : sendText(destino, mensagem);
    }
    const links = (opcoes.botoes ?? []).flat().filter((b) => b.url).map((b) => `${b.text}: ${b.url}`);
    return sendText(destino, links.length > 0 ? `${mensagem}\n\n${links.join("\n")}` : mensagem);
  };

  if (!ehTelegram(numero)) {
    try {
      await enviarPara(numero);
      return;
    } catch (error) {
      if (extras.length === 0) throw error;
      console.error("Aviso pelo WhatsApp falhou, usando o Telegram:", error);
    }
  }

  const unicos = Array.from(new Set(destinosTelegram));
  const resultados = await Promise.allSettled(unicos.map((d) => enviarPara(d)));
  if (resultados.every((r) => r.status === "rejected")) {
    throw (resultados[0] as PromiseRejectedResult).reason;
  }
}

/**
 * Feed da equipe: se TELEGRAM_GRUPO_ID estiver configurado, cada lancamento
 * novo tambem aparece no grupo do Telegram (o bot precisa estar no grupo).
 * Nunca derruba quem chamou.
 */
async function postarNoGrupo(mensagem: string, botoes?: Teclado): Promise<void> {
  const grupoId = (process.env.TELEGRAM_GRUPO_ID ?? "").trim();
  if (!/^-?\d+$/.test(grupoId)) return;
  try {
    const destino = destinoTelegram(grupoId);
    await (botoes ? sendTelegramTextComBotoes(destino, mensagem, botoes) : sendText(destino, mensagem));
  } catch (error) {
    console.error("Falha ao postar no grupo do Telegram:", error);
  }
}

/** Roda todo dia às 22h (Brasília) — resumo do dia por conta e por obra/etapa. Manda sempre, mesmo sem lançamento. */
export async function enviarResumoDiario(): Promise<{ enviado: boolean; motivo?: string }> {
  const numero = await numeroNotificacao();
  if (!numero) return { enviado: false, motivo: "Nenhum número de WhatsApp configurado para notificações." };

  const hoje = hojeNoBrasil();
  const resumo = await buscarResumoPeriodo(hoje, hoje);
  const mensagem = formatarResumoDiario(formatarDataBRCurta(hoje), resumo);

  await enviarNotificacao(numero, mensagem, { botoes: TECLADO_RESUMO });
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

  await enviarNotificacao(numero, mensagem, { botoes: TECLADO_RESUMO });
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
  obraId: string | null;
  descricao: string | null;
  materialId: string | null;
  autorTelefone: string | null;
  autorNome: string | null;
  documentoAnexado: "documento_cobranca" | "comprovante_pagamento" | null;
}): Promise<void> {
  const numero = await numeroNotificacao();
  const temGrupo = /^-?\d+$/.test((process.env.TELEGRAM_GRUPO_ID ?? "").trim());
  // Dono: nao avisa de algo que ele mesmo acabou de fazer. Grupo: sempre.
  const avisarDono = Boolean(numero) && !(input.autorTelefone && input.autorTelefone === numero);
  if (!avisarDono && !temGrupo) return;

  const supabase = createAdminClient();
  const [{ data: categoria }, { data: obra }, { data: material }] = await Promise.all([
    supabase.from("categorias").select("nome").eq("id", input.categoriaId).maybeSingle(),
    input.obraId
      ? supabase.from("obras").select("nome").eq("id", input.obraId).maybeSingle()
      : Promise.resolve({ data: null }),
    input.materialId
      ? supabase.from("materiais").select("nome").eq("id", input.materialId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const mensagem = formatarNotificacaoLancamento({
    valor: input.valor,
    categoriaNome: categoria?.nome ?? "Sem categoria",
    obraNome: obra?.nome ?? null,
    autorNome: input.autorNome,
    descricao: input.descricao,
    materialNome: material?.nome ?? null,
    documentoAnexado: input.documentoAnexado,
  });
  const botoes: Teclado = [[botaoDashboard("/despesas", "🧾 Ver lançamentos")]];
  await postarNoGrupo(mensagem, botoes);
  if (avisarDono && numero) await enviarNotificacao(numero, mensagem, { botoes });
}

/**
 * O comprovante de pagamento normalmente e anexado numa mensagem SEPARADA,
 * depois do lancamento original ja ter sido notificado - essa notificacao
 * de acompanhamento fecha o ciclo (o dono sabe que o pagamento comprovado
 * chegou, sem precisar abrir o dashboard).
 */
export async function notificarComprovantePagamentoAnexado(input: {
  valor: number;
  obraId: string | null;
  autorTelefone: string | null;
  autorNome: string | null;
}): Promise<void> {
  const numero = await numeroNotificacao();
  const temGrupo = /^-?\d+$/.test((process.env.TELEGRAM_GRUPO_ID ?? "").trim());
  const avisarDono = Boolean(numero) && !(input.autorTelefone && input.autorTelefone === numero);
  if (!avisarDono && !temGrupo) return;

  let obraNome: string | null = null;
  if (input.obraId) {
    const supabase = createAdminClient();
    const { data: obra } = await supabase.from("obras").select("nome").eq("id", input.obraId).maybeSingle();
    obraNome = obra?.nome ?? null;
  }

  const mensagem = formatarNotificacaoComprovantePagamento({
    valor: input.valor,
    obraNome,
    autorNome: input.autorNome,
  });
  await postarNoGrupo(mensagem);
  if (avisarDono && numero) await enviarNotificacao(numero, mensagem);
}
