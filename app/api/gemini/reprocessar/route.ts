import { NextRequest, NextResponse, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractInvoiceData } from "@/lib/gemini/extractInvoice";
import {
  MAX_TENTATIVAS,
  dispararTentativa,
  esperaAntesDaTentativa,
  marcarLeitura,
  reservarTentativa,
} from "@/lib/gemini/leiturasPendentes";
import { retomarDocumentoLido } from "@/lib/conversation/engine";
import { sendText } from "@/lib/whatsapp/messages";

// espera (ate 20s) + leitura (28s) + retomada da conversa cabem nos 60s.
export const maxDuration = 60;
const ORCAMENTO_LEITURA_MS = 28_000;

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Comprovante = Parameters<typeof retomarDocumentoLido>[2];

async function executarTentativa(id: string, esperaMs: number) {
  const leitura = await reservarTentativa(id);
  if (!leitura) return; // ja concluida, desistida ou em andamento em outra cadeia

  const tentativa = leitura.tentativas + 1;
  const comprovante = leitura.comprovante as unknown as Comprovante;

  let invoice: Awaited<ReturnType<typeof extractInvoiceData>> = null;
  let motivo = "Gemini nao devolveu dados legiveis";
  try {
    if (esperaMs > 0) await dormir(Math.min(esperaMs, 20_000));

    const supabase = createAdminClient();
    const { data: blob, error } = await supabase.storage
      .from(comprovante.bucket)
      .download(comprovante.path);
    if (error || !blob) throw new Error(`Arquivo nao encontrado no Storage: ${error?.message ?? ""}`);

    invoice = await extractInvoiceData(Buffer.from(await blob.arrayBuffer()), comprovante.mimeType, {
      orcamentoMs: ORCAMENTO_LEITURA_MS,
    });
  } catch (error) {
    motivo = error instanceof Error ? error.message : String(error);
    console.error(`Tentativa ${tentativa} de leitura pendente ${id} falhou:`, error);
  }

  const leu = invoice && (invoice.itens.length > 0 || Boolean(invoice.valorTotalNota));
  if (leu && invoice) {
    await marcarLeitura(id, { status: "concluida", tentativas: tentativa, ultimo_erro: null });
    try {
      await retomarDocumentoLido(leitura.telefone, invoice, comprovante, leitura.forcar_nova_despesa);
    } catch (error) {
      console.error(`Leitura ${id} concluida, mas falhou ao retomar a conversa:`, error);
      Sentry.captureException(error, { tags: { fluxo: "leitura_pendente", etapa: "retomar" } });
    }
    return;
  }

  if (tentativa >= MAX_TENTATIVAS) {
    await marcarLeitura(id, { status: "desistiu", tentativas: tentativa, ultimo_erro: motivo });
    Sentry.captureMessage(`Leitura pendente ${id} desistiu apos ${tentativa} tentativas: ${motivo}`, "error");
    await sendText(
      leitura.telefone,
      "😕 Não consegui ler o documento que você enviou, mesmo depois de várias tentativas. Ele ficou guardado. Use o menu → Registrar Despesa pra lançar manualmente, ou envie o arquivo de novo mais tarde."
    ).catch((error) => console.error("Falha ao avisar desistencia da leitura:", error));
    return;
  }

  await marcarLeitura(id, { status: "pendente", tentativas: tentativa, ultimo_erro: motivo });
  await dispararTentativa(id, esperaAntesDaTentativa(tentativa));
}

export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let corpo: { id?: string; esperaMs?: number };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  if (!corpo.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { id, esperaMs = 0 } = corpo;
  // Responde na hora e faz o trabalho depois - quem disparou nao fica esperando.
  after(() =>
    executarTentativa(id, esperaMs).catch((error) => {
      console.error(`Erro inesperado na leitura pendente ${id}:`, error);
      Sentry.captureException(error, { tags: { fluxo: "leitura_pendente" } });
    })
  );
  return NextResponse.json({ aceito: true }, { status: 202 });
}
