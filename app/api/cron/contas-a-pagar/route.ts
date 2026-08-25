import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { buscarContasParaAvisar } from "@/lib/contasAPagar/queries";
import { numeroNotificacao } from "@/lib/alertas/notificar";
import { formatarAvisoContasAPagar } from "@/lib/whatsapp/notificacoes";
import { sendText } from "@/lib/whatsapp/messages";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const numero = await numeroNotificacao();
    if (!numero) {
      return NextResponse.json({ enviado: false, motivo: "Nenhum número configurado." });
    }

    const { vencendo, vencidas } = await buscarContasParaAvisar();
    if (vencendo.length === 0 && vencidas.length === 0) {
      return NextResponse.json({ enviado: false, motivo: "Nada a avisar hoje." });
    }

    const mensagem = formatarAvisoContasAPagar({ vencendo, vencidas });
    await sendText(numero, mensagem);

    return NextResponse.json({ enviado: true, vencendo: vencendo.length, vencidas: vencidas.length });
  } catch (error) {
    console.error("Erro ao enviar aviso de contas a pagar:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Falha ao enviar aviso" }, { status: 500 });
  }
}
