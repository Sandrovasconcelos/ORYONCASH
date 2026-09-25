import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { isAllowedNumber } from "@/lib/whatsapp/verify";
import { handleIncomingMessage } from "@/lib/conversation/engine";
import { excedeuLimiteDeTaxa } from "@/lib/whatsapp/rateLimit";
import {
  comTimeoutDeAviso,
  jaProcessadaOuMarcarComoProcessada,
} from "@/lib/whatsapp/processar";
import { parseTelegramUpdate, type TgUpdate } from "@/lib/telegram/parse";
import { telegramCall } from "@/lib/telegram/api";
import { sendTelegramText } from "@/lib/telegram/messages";
import { chatIdDe } from "@/lib/telegram/ids";

// Mesmo teto do webhook do WhatsApp: baixar midia + Gemini passa dos 10s.
export const maxDuration = 60;

function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Toque em botao: avisa o Telegram que foi recebido e tira o teclado da mensagem (evita toque em opcao velha). */
async function responderToque(callback: { queryId: string; chatId: number; messageId: number }) {
  await telegramCall("answerCallbackQuery", { callback_query_id: callback.queryId }).catch(() => {});
  await telegramCall("editMessageReplyMarkup", {
    chat_id: callback.chatId,
    message_id: callback.messageId,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => {});
}

/**
 * Checagem de saude (protegida pelo mesmo segredo do webhook): confirma que
 * o token configurado NESTE ambiente e aceito pelo Telegram, sem precisar
 * ler logs. Nunca devolve o token.
 */
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

  const { incoming, callback } = parseTelegramUpdate(update);
  if (callback) await responderToque(callback);
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

  try {
    await comTimeoutDeAviso(incoming.from, handleIncomingMessage(incoming));
  } catch (error) {
    console.error("Erro ao processar mensagem do Telegram:", error);
    Sentry.captureException(error);
  }

  return NextResponse.json({ ok: true });
}
