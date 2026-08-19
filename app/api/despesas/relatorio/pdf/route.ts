import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarDadosRelatorio, type FiltrosRelatorio } from "@/lib/relatorio/dados";
import { gerarRelatorioPdfBuffer } from "@/lib/relatorio/pdf";
import { formatDataHoraBrasil } from "@/lib/format-date";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const filtros: FiltrosRelatorio = {
    obra: params.get("obra") ?? undefined,
    categoria: params.get("categoria") ?? undefined,
    etapa: params.get("etapa") ?? undefined,
    material: params.get("material") ?? undefined,
    fornecedor: params.get("fornecedor") ?? undefined,
    ids: params.get("ids") ?? undefined,
    dataInicio: params.get("dataInicio") ?? undefined,
    dataFim: params.get("dataFim") ?? undefined,
  };

  const dados = await buscarDadosRelatorio(filtros);
  const geradoEm = formatDataHoraBrasil(new Date().toISOString());
  const buffer = await gerarRelatorioPdfBuffer(dados, geradoEm);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="relatorio-oryoncash.pdf"',
    },
  });
}
