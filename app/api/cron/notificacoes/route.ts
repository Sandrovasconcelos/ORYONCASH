import { NextRequest, NextResponse } from "next/server";
import { enviarNotificacaoDiaria } from "@/lib/alertas/notificar";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const resultado = await enviarNotificacaoDiaria();
  return NextResponse.json(resultado);
}
