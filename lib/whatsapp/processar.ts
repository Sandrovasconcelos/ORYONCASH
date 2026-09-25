import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function comTimeoutDeAviso(from: string, promise: Promise<void>): Promise<void> {
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
 * A Meta reentrega webhooks que nao respondem rapido o suficiente (ou por
 * falhas de rede) - sem essa checagem, a mesma mensagem processada duas
 * vezes cria o mesmo lancamento duas vezes. So processa se conseguir
 * "reservar" o wamid; se a tabela nao existir ainda (migration pendente),
 * segue o fluxo normalmente em vez de travar tudo.
 */
export async function jaProcessadaOuMarcarComoProcessada(wamid: string | null): Promise<boolean> {
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

