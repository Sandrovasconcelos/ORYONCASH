import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gerarEEnviarBackup } from "@/lib/backup/exportar";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const resultado = await gerarEEnviarBackup();
    if (resultado.erros.length > 0) {
      console.error("Backup concluido com erros:", resultado.erros);
    }
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao gerar backup:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Falha ao gerar backup" }, { status: 500 });
  }
}
