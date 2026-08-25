import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyWebhookSignature, isAllowedNumber } from "@/lib/whatsapp/verify";
import { parseIncomingMessage } from "@/lib/whatsapp/parse";
import { handleIncomingMessage } from "@/lib/conversation/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { excedeuLimiteDeTaxa } from "@/lib/whatsapp/rateLimit";

/**
 * Baixar a midia do WhatsApp + chamar o Gemini pra ler nota/comprovante
 * facilmente passa dos 10s padrao da Vercel (Hobby), matando a funcao no
 * meio do processamento - a mensagem ja tinha sido marcada como
 * "processada" (linha abaixo) mas nunca chega a receber resposta, entao um
 * reenvio de retry da Meta (mesmo wamid) e ignorado pra sempre. 60s e o
 * teto permitido no plano Hobby.
 */
export const maxDuration = 60;

/**
 * A Meta reentrega webhooks que nao respondem rapido o suficiente (ou por
 * falhas de rede) - sem essa checagem, a mesma mensagem processada duas
 * vezes cria o mesmo lancamento duas vezes. So processa se conseguir
 * "reservar" o wamid; se a tabela nao existir ainda (migration pendente),
 * segue o fluxo normalmente em vez de travar tudo.
 */
async function jaProcessadaOuMarcarComoProcessada(wamid: string | null): Promise<boolean> {
  if (!wamid) return false;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("whatsapp_mensagens_processadas")
      .insert({ wamid });
    if (error) {
      if (error.code === "23505") return true; // ja existia = mensagem repetida
      return false; // outro erro (ex: migration nao aplicada) - nao bloqueia
    }
    return false;
  } catch {
    return false;
  }
}

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
    await handleIncomingMessage(message);
  } catch (error) {
    console.error("Erro ao processar mensagem do WhatsApp:", error);
    Sentry.captureException(error);
  }

  return NextResponse.json({ ok: true });
}
