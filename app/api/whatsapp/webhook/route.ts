import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyWebhookSignature, isAllowedNumber } from "@/lib/whatsapp/verify";
import { parseIncomingMessage } from "@/lib/whatsapp/parse";
import { handleIncomingMessage } from "@/lib/conversation/engine";
import { excedeuLimiteDeTaxa } from "@/lib/whatsapp/rateLimit";
import {
  comTimeoutDeAviso,
  jaProcessadaOuMarcarComoProcessada,
} from "@/lib/whatsapp/processar";

/**
 * Baixar a midia do WhatsApp + chamar o Gemini pra ler nota/comprovante
 * facilmente passa dos 10s padrao da Vercel (Hobby), matando a funcao no
 * meio do processamento - a mensagem ja tinha sido marcada como
 * "processada" (linha abaixo) mas nunca chega a receber resposta, entao um
 * reenvio de retry da Meta (mesmo wamid) e ignorado pra sempre. 60s e o
 * teto permitido no plano Hobby.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const message = parseIncomingMessage(payload);

  // Nao ha mensagem (ex.: evento de status de entrega) - apenas confirma o recebimento.
  if (!message) {
    return NextResponse.json({ ok: true });
  }

  if (await jaProcessadaOuMarcarComoProcessada(message.id)) {
    return NextResponse.json({ ok: true });
  }

  if (!(await isAllowedNumber(message.from))) {
    return NextResponse.json({ ok: true });
  }

  if (await excedeuLimiteDeTaxa(message.from)) {
    console.error(`Rate limit excedido pro numero ${message.from}`);
    return NextResponse.json({ ok: true });
  }

  try {
    await comTimeoutDeAviso(message.from, handleIncomingMessage(message));
  } catch (error) {
    console.error("Erro ao processar mensagem do WhatsApp:", error);
    Sentry.captureException(error);
  }

  return NextResponse.json({ ok: true });
}
