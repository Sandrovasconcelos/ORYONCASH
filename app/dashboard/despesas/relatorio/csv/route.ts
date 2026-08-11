import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("despesas")
    .select(
      "id, valor, descricao, data, origem, created_at, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome)"
    )
    .is("deleted_at", null)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length > 0) {
    query = query.in("id", ids);
  } else {
    const obra = params.get("obra");
    const categoria = params.get("categoria");
    const etapa = params.get("etapa");
    const material = params.get("material");
    const fornecedor = params.get("fornecedor");

    if (obra) query = query.eq("obra_id", obra);
    if (categoria) query = query.eq("categoria_id", categoria);
    if (etapa) query = query.eq("etapa_id", etapa);
    if (material) query = query.eq("material_id", material);
    if (fornecedor) query = query.eq("fornecedor_id", fornecedor);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const header = [
    "Data",
    "Obra",
    "Categoria",
    "Etapa",
    "Material",
    "Descricao",
    "Fornecedor",
    "Valor",
    "Origem",
    "Registrado em",
  ];

  const rows = (data ?? []).map((d) => [
    d.data,
    (d.obras as unknown as { nome: string } | null)?.nome,
    (d.categorias as unknown as { nome: string } | null)?.nome,
    (d.etapas as unknown as { nome: string } | null)?.nome,
    (d.materiais as unknown as { nome: string } | null)?.nome,
    d.descricao,
    (d.fornecedores as unknown as { nome: string } | null)?.nome,
    d.valor,
    d.origem,
    d.created_at,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");

  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="lancamentos-oryoncash.csv"',
    },
  });
}
