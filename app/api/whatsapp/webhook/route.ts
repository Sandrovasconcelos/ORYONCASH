import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, isAllowedNumber } from "@/lib/whatsapp/verify";
import { parseIncomingMessage } from "@/lib/whatsapp/parse";
import { handleIncomingMessage } from "@/lib/conversation/engine";

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

  if (!isAllowedNumber(message.from)) {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleIncomingMessage(message);
  } catch (error) {
    console.error("Erro ao processar mensagem do WhatsApp:", error);
  }

  return NextResponse.json({ ok: true });
}
