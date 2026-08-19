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
      "id, valor, quantidade, valor_unitario, descricao, data, origem, created_at, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome)"
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
    const dataInicio = params.get("dataInicio");
    const dataFim = params.get("dataFim");

    if (obra) query = query.eq("obra_id", obra);
    if (categoria) query = query.eq("categoria_id", categoria);
    if (etapa) query = query.eq("etapa_id", etapa);
    if (material) query = query.eq("material_id", material);
    if (fornecedor) query = query.eq("fornecedor_id", fornecedor);
    if (dataInicio) query = query.gte("data", dataInicio);
    if (dataFim) query = query.lte("data", dataFim);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const despesas = data ?? [];
  const idsDespesas = despesas.map((d) => d.id);
  const { data: comprovantesData } =
    idsDespesas.length > 0
      ? await supabase
          .from("despesa_comprovantes")
          .select("despesa_id, tipo_documento, storage_bucket, storage_path")
          .in("despesa_id", idsDespesas)
      : { data: [] };

  // Mesma validade de 7 dias do relatorio em PDF - CSV tambem costuma ser
  // salvo/reaberto depois, entao o link nao pode expirar em 1h.
  const VALIDADE_LINK_DOCUMENTO = 60 * 60 * 24 * 7;
  const documentosPorDespesa = new Map<string, { nota: string | null; comprovante: string | null }>();
  await Promise.all(
    (comprovantesData ?? []).map(async (c) => {
      if (!c.despesa_id) return;
      const { data: signed } = await supabase.storage
        .from(c.storage_bucket)
        .createSignedUrl(c.storage_path, VALIDADE_LINK_DOCUMENTO);
      const atual = documentosPorDespesa.get(c.despesa_id) ?? { nota: null, comprovante: null };
      if (c.tipo_documento === "comprovante_pagamento") atual.comprovante = signed?.signedUrl ?? null;
      else atual.nota = signed?.signedUrl ?? null;
      documentosPorDespesa.set(c.despesa_id, atual);
    })
  );

  const header = [
    "Data",
    "Obra",
    "Categoria",
    "Etapa",
    "Material",
    "Descricao",
    "Fornecedor",
    "Quantidade",
    "Valor unitario",
    "Valor",
    "Origem",
    "Registrado em",
    "Link da nota",
    "Link do comprovante",
  ];

  const rows = despesas.map((d) => {
    const documentos = documentosPorDespesa.get(d.id);
    return [
      d.data,
      (d.obras as unknown as { nome: string } | null)?.nome,
      (d.categorias as unknown as { nome: string } | null)?.nome,
      (d.etapas as unknown as { nome: string } | null)?.nome,
      (d.materiais as unknown as { nome: string } | null)?.nome,
      d.descricao,
      (d.fornecedores as unknown as { nome: string } | null)?.nome,
      d.quantidade ?? "",
      d.valor_unitario ?? "",
      d.valor,
      d.origem,
      d.created_at,
      documentos?.nota ?? "",
      documentos?.comprovante ?? "",
    ];
  });

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
