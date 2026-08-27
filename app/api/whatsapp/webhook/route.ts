import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyWebhookSignature, isAllowedNumber } from "@/lib/whatsapp/verify";
import { parseIncomingMessage } from "@/lib/whatsapp/parse";
import { handleIncomingMessage } from "@/lib/conversation/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { excedeuLimiteDeTaxa } from "@/lib/whatsapp/rateLimit";
import { sendText } from "@/lib/whatsapp/messages";

/**
 * Se o processamento (download de midia + Gemini) travar por algum motivo
 * imprevisto, a Vercel mata a funcao no teto de 60s sem chance de responder
 * nada ao usuario - ele fica olhando pro "Recebi seu documento,
 * analisando..." pra sempre. Esse teto avisa ANTES disso acontecer: se
 * handleIncomingMessage nao terminar em 55s, manda uma mensagem de erro
 * pro usuario mesmo que o processamento original ainda esteja rodando (o
 * Promise.race nao cancela a promise perdedora - ela pode ainda terminar
 * depois e mandar a resposta de verdade, o que é raro mas inofensivo).
 */
const TIMEOUT_PROCESSAMENTO_MS = 55_000;

async function comTimeoutDeAviso(from: string, promise: Promise<void>): Promise<void> {
  let avisouTimeout = false;

  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), TIMEOUT_PROCESSAMENTO_MS);
  });

  const resultado = await Promise.race([promise.then(() => "ok" as const), timeout]);

  if (resultado === "timeout") {
    avisouTimeout = true;
    console.error(`Timeout (${TIMEOUT_PROCESSAMENTO_MS}ms) ao processar mensagem de ${from}`);
    Sentry.captureMessage(`Timeout ao processar mensagem do WhatsApp (${from})`, "warning");
    await sendText(
      from,
      "⚠️ Isso demorou mais do que o esperado e não consegui terminar de processar. Pode tentar reenviar? Se for uma imagem grande, tente uma foto mais simples ou um PDF menor."
    ).catch((error) => console.error("Falha ao avisar timeout pro usuário:", error));
  }

  // Deixa a promise original seguir em segundo plano (pode ainda terminar e
  // mandar sua propria resposta) - so garante que erros dela nao escapem
  // sem log depois que ja desistimos de esperar.
  if (avisouTimeout) {
    promise.catch((error) => console.error("Processamento atrasado falhou depois do aviso de timeout:", error));
  }
}

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
    await comTimeoutDeAviso(message.from, handleIncomingMessage(message));
  } catch (error) {
    console.error("Erro ao processar mensagem do WhatsApp:", error);
    Sentry.captureException(error);
  }

  return NextResponse.json({ ok: true });
}
