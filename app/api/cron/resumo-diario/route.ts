import { NextRequest, NextResponse } from "next/server";
import { enviarResumoDiario } from "@/lib/alertas/notificar";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const resultado = await enviarResumoDiario();
  return NextResponse.json(resultado);
}
