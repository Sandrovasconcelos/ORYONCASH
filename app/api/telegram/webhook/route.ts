import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { isAllowedNumber } from "@/lib/whatsapp/verify";
import { abrirAcaoDeDespesa, handleIncomingMessage, iniciarLancamentoDeTransacao } from "@/lib/conversation/engine";
import { cartaoPorId } from "@/lib/conciliacao/avisos";
import {
  desfazerLancamentoPorBotao,
  pagarContaPorBotao,
  resolverPagamentoPorBotao,
  type AcaoDePagamento,
} from "@/lib/conversation/acoes";
import { excedeuLimiteDeTaxa } from "@/lib/whatsapp/rateLimit";
import {
  comTimeoutDeAviso,
  jaProcessadaOuMarcarComoProcessada,
} from "@/lib/whatsapp/processar";
import { parseTelegramUpdate, type TgUpdate, type Toque } from "@/lib/telegram/parse";
import { telegramCall } from "@/lib/telegram/api";
import { sendTelegramText, sendTelegramTextComBotoes } from "@/lib/telegram/messages";
import { chatIdDe } from "@/lib/telegram/ids";
import {
  extrairItensNumerados,
  mensagemComEscolha,
  rotuloDoBotao,
  tecladoDaPagina,
} from "@/lib/telegram/interativo";

// Mesmo teto do webhook do WhatsApp: baixar midia + Gemini passa dos 10s.
export const maxDuration = 60;

function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

const semTeclado = { inline_keyboard: [] };

/** Avisa o Telegram que o toque foi recebido (senao o botao fica com relogio girando). */
async function confirmarToque(toque: Toque) {
  await telegramCall("answerCallbackQuery", { callback_query_id: toque.queryId }).catch(() => {});
}

/** Troca de pagina numa lista longa - resolvido aqui, o motor nem fica sabendo. */
async function navegarPagina(toque: Toque) {
  if (toque.data === "pg:x") return;
  const pagina = Number(toque.data.slice(3));
  const itens = extrairItensNumerados(toque.texto);
  if (!Number.isFinite(pagina) || itens.length === 0) return;
  await telegramCall("editMessageReplyMarkup", {
    chat_id: toque.chatId,
    message_id: toque.messageId,
    reply_markup: { inline_keyboard: tecladoDaPagina(itens, pagina) },
  }).catch(() => {});
}

/**
 * Depois do toque, a mensagem vira o registro da escolha (sem o teclado) em
 * vez de ficar cheia de botoes velhos e de o chat virar uma fila de perguntas.
 */
async function registrarEscolha(toque: Toque) {
  let rotulo: string | null = null;
  if (toque.data.startsWith("n:")) {
    const numero = Number(toque.data.slice(2));
    const item = extrairItensNumerados(toque.texto).find((i) => i.numero === numero);
    rotulo = item ? `${item.numero}. ${item.rotulo}` : `${numero}`;
  } else {
    rotulo = rotuloDoBotao(toque.teclado, toque.data);
  }

  try {
    if (!rotulo || !toque.texto) throw new Error("sem texto pra editar");
    const nova = mensagemComEscolha(toque.texto, toque.entidades, rotulo);
    await telegramCall("editMessageText", {
      chat_id: toque.chatId,
      message_id: toque.messageId,
      text: nova.texto,
      ...(nova.entidades.length > 0 ? { entities: nova.entidades } : {}),
      reply_markup: semTeclado,
    });
  } catch {
    await telegramCall("editMessageReplyMarkup", {
      chat_id: toque.chatId,
      message_id: toque.messageId,
      reply_markup: semTeclado,
    }).catch(() => {});
  }
}

/**
 * Botao "Paguei" do aviso de contas a pagar: marca a conta como paga (cria a
 * despesa) e responde com um aviso rapido na tela; o botao dessa conta some.
 */
async function pagarConta(toque: Toque) {
  const r = await pagarContaPorBotao(toque.de, toque.data.slice(3));

  await telegramCall("answerCallbackQuery", {
    callback_query_id: toque.queryId,
    text: r.texto,
    show_alert: !r.ok,
  }).catch(() => {});

  const restante = toque.teclado
    .map((linha) => linha.filter((b) => b.callback_data !== toque.data))
    .filter((linha) => linha.length > 0);
  await telegramCall("editMessageReplyMarkup", {
    chat_id: toque.chatId,
    message_id: toque.messageId,
    reply_markup: { inline_keyboard: restante },
  }).catch(() => {});
}

/** Tira do aviso os botoes de acao sobre o lancamento (sobram so os links). */
async function removerBotoesDeAcao(toque: Toque) {
  const restante = toque.teclado
    .map((linha) => linha.filter((b) => !b.callback_data))
    .filter((linha) => linha.length > 0);
  await telegramCall("editMessageReplyMarkup", {
    chat_id: toque.chatId,
    message_id: toque.messageId,
    reply_markup: { inline_keyboard: restante },
  }).catch(() => {});
}

/** Botao "Desfazer" do aviso de lancamento (vale por 15 min). */
async function desfazerLancamento(toque: Toque) {
  const r = await desfazerLancamentoPorBotao(toque.de, toque.data.slice(3));

  await telegramCall("answerCallbackQuery", {
    callback_query_id: toque.queryId,
    text: r.texto,
    show_alert: r.status !== "desfeita",
  }).catch(() => {});

  if (r.status === "desfeita") {
    if (toque.texto) {
      await telegramCall("editMessageText", {
        chat_id: toque.chatId,
        message_id: toque.messageId,
        text: `${toque.texto}\n\n↩️ Desfeito por ${r.autorNome}`,
        ...(toque.entidades.length > 0 ? { entities: toque.entidades } : {}),
        reply_markup: { inline_keyboard: [] },
      }).catch(() => removerBotoesDeAcao(toque));
    } else {
      await removerBotoesDeAcao(toque);
    }
  } else if (r.status === "expirou") {
    // segue valendo Corrigir/Comprovante; so o Desfazer perde o sentido
    const restante = toque.teclado
      .map((linha) => linha.filter((b) => b.callback_data !== toque.data))
      .filter((linha) => linha.length > 0);
    await telegramCall("editMessageReplyMarkup", {
      chat_id: toque.chatId,
      message_id: toque.messageId,
      reply_markup: { inline_keyboard: restante },
    }).catch(() => {});
  }
}

/** Botoes "Corrigir" / "Comprovante": continuam a conversa no chat privado com o bot. */
async function abrirAcaoDoAviso(toque: Toque) {
  const acao = toque.data.startsWith("cr:") ? "corrigir" : "anexar";
  const despesaId = toque.data.slice(3);
  await telegramCall("answerCallbackQuery", {
    callback_query_id: toque.queryId,
    text: String(toque.chatId) === chatIdDe(toque.de) ? undefined : "Continue no chat privado com o bot.",
  }).catch(() => {});
  try {
    await comTimeoutDeAviso(toque.de, abrirAcaoDeDespesa(toque.de, acao, despesaId));
  } catch (error) {
    console.error("Erro ao abrir ação do aviso de lançamento:", error);
    Sentry.captureException(error);
  }
}

/** Toque num pagamento do aviso do extrato: manda o cartao com as acoes. */
async function abrirPagamento(toque: Toque) {
  const cartao = await cartaoPorId(toque.data.slice(3));
  if (!cartao) {
    await telegramCall("answerCallbackQuery", {
      callback_query_id: toque.queryId,
      text: "Esse pagamento já foi resolvido.",
    }).catch(() => {});
    return;
  }
  await telegramCall("answerCallbackQuery", { callback_query_id: toque.queryId }).catch(() => {});
  await sendTelegramTextComBotoes(toque.de, cartao.mensagem, cartao.botoes);
}

/** Lancar / ignorar so este / ignorar sempre, no cartao de um pagamento do extrato. */
async function resolverPagamento(toque: Toque) {
  const acao = toque.data.slice(0, 2) as AcaoDePagamento;
  const id = toque.data.slice(3);
  const r = await resolverPagamentoPorBotao(toque.de, acao, id);
  const resultado = r.texto;

  await telegramCall("answerCallbackQuery", {
    callback_query_id: toque.queryId,
    text: resultado,
  }).catch(() => {});
  await telegramCall("editMessageText", {
    chat_id: toque.chatId,
    message_id: toque.messageId,
    text: `${toque.texto}\n\n${resultado}`,
    ...(toque.entidades.length > 0 ? { entities: toque.entidades } : {}),
    reply_markup: semTeclado,
  }).catch(() => removerBotoesDeAcao(toque));

  if (r.status === "ok" && acao === "xl") {
    try {
      await comTimeoutDeAviso(toque.de, iniciarLancamentoDeTransacao(toque.de, id));
    } catch (error) {
      console.error("Erro ao iniciar lançamento do extrato:", error);
      Sentry.captureException(error);
    }
  }
}

export async function GET(request: NextRequest) {
  if (!segredoValido(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new NextResponse("Forbidden", { status: 401 });
  }
  try {
    const bot = await telegramCall<{ username?: string }>("getMe", {});
    return NextResponse.json({ ok: true, bot: bot.username ?? null });
  } catch (error) {
    return NextResponse.json({ ok: false, erro: error instanceof Error ? error.message : String(error) });
  }
}

export async function POST(request: NextRequest) {
  if (!segredoValido(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new NextResponse("Forbidden", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Grupo: o bot nao conversa la, mas /id devolve o id do grupo (pra
  // configurar TELEGRAM_GRUPO_ID e receber o feed de lancamentos).
  const grupo = update.message;
  if (
    grupo &&
    (grupo.chat.type === "group" || grupo.chat.type === "supergroup") &&
    grupo.text?.trim().toLowerCase().startsWith("/id")
  ) {
    await telegramCall("sendMessage", {
      chat_id: grupo.chat.id,
      text: `ID deste grupo: ${grupo.chat.id}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const { incoming, callback } = parseTelegramUpdate(update);

  if (callback) {
    if (!/^(cp|dz|cr|ap|xl|xi|xs|xv):/.test(callback.data)) await confirmarToque(callback);
    if (callback.data.startsWith("pg:")) {
      await navegarPagina(callback);
      return NextResponse.json({ ok: true });
    }
  }
  if (!incoming) return NextResponse.json({ ok: true });

  if (await jaProcessadaOuMarcarComoProcessada(incoming.id)) {
    return NextResponse.json({ ok: true });
  }

  if (!(await isAllowedNumber(incoming.from))) {
    // Quem nao esta liberado so descobre o proprio id - e o que o dono
    // precisa pra autorizar em Acessos. Limitado pra nao virar spam.
    if (update.message?.text?.startsWith("/start") && !(await excedeuLimiteDeTaxa(incoming.from))) {
      await sendTelegramText(
        incoming.from,
        `Você ainda não está autorizado a usar o OryonCash.\n\nSeu ID: ${incoming.from}\n\nPeça pra quem administra liberar esse ID em Acessos, no dashboard.`
      ).catch((error) => console.error("Falha ao responder /start de nao autorizado:", error));
    }
    return NextResponse.json({ ok: true });
  }

  if (await excedeuLimiteDeTaxa(incoming.from)) {
    console.error(`Rate limit excedido pro usuario ${chatIdDe(incoming.from)} (Telegram)`);
    return NextResponse.json({ ok: true });
  }

  if (callback?.data.startsWith("cp:")) {
    await pagarConta(callback);
    return NextResponse.json({ ok: true });
  }

  if (callback?.data.startsWith("xp:")) {
    await abrirPagamento(callback);
    return NextResponse.json({ ok: true });
  }

  if (callback && /^(xl|xi|xs|xv):/.test(callback.data)) {
    await resolverPagamento(callback);
    return NextResponse.json({ ok: true });
  }

  if (callback?.data.startsWith("dz:")) {
    await desfazerLancamento(callback);
    return NextResponse.json({ ok: true });
  }

  if (callback && /^(cr|ap):/.test(callback.data)) {
    await abrirAcaoDoAviso(callback);
    return NextResponse.json({ ok: true });
  }

  if (callback) await registrarEscolha(callback);

  try {
    await comTimeoutDeAviso(incoming.from, handleIncomingMessage(incoming));
  } catch (error) {
    console.error("Erro ao processar mensagem do Telegram:", error);
    Sentry.captureException(error);
  }

  return NextResponse.json({ ok: true });
}
