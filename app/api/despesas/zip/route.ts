import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { formatDataBrasil, formatDataHoraBrasil } from "@/lib/format-date";

const MAX_IDS = 200;

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

function extensaoDe(nomeArquivo: string | null, mimeType: string | null): string {
  const doNome = nomeArquivo?.split(".").pop();
  if (doNome && doNome.length <= 5) return `.${doNome.toLowerCase()}`;
  const doMime = mimeType?.split("/")[1]?.replace("jpeg", "jpg");
  return doMime ? `.${doMime}` : "";
}

function nomeDe(relacao: unknown): string {
  return (relacao as { nome: string } | null)?.nome ?? "-";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhum lançamento selecionado" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: despesas }, { data: comprovantes }] = await Promise.all([
    admin
      .from("despesas")
      .select("id, valor, descricao, data, obras(nome), categorias(nome), fornecedores(nome)")
      .in("id", ids)
      .is("deleted_at", null)
      .order("data", { ascending: false }),
    admin
      .from("despesa_comprovantes")
      .select("id, despesa_id, tipo_documento, storage_bucket, storage_path, mime_type, nome_arquivo")
      .in("despesa_id", ids),
  ]);

  if (!despesas || despesas.length === 0) {
    return NextResponse.json({ error: "Nenhum lançamento encontrado" }, { status: 404 });
  }

  const comprovantesPorDespesa = new Map<string, typeof comprovantes>();
  for (const c of comprovantes ?? []) {
    if (!c.despesa_id) continue;
    const lista = comprovantesPorDespesa.get(c.despesa_id) ?? [];
    lista.push(c);
    comprovantesPorDespesa.set(c.despesa_id, lista);
  }

  const usados = new Set<string>();
  const pastaPorDespesa = new Map<string, string>();
  for (const d of despesas) {
    let base = slug(`${formatDataBrasil(d.data)}-${d.descricao || nomeDe(d.obras)}`) || d.id.slice(0, 8);
    let pasta = base;
    let sufixo = 2;
    while (usados.has(pasta)) {
      pasta = `${base}-${sufixo}`;
      sufixo += 1;
    }
    usados.add(pasta);
    pastaPorDespesa.set(d.id, pasta);
  }

  // Baixa todos os arquivos em paralelo em vez de um por um - a mesma
  // licao do N+1 sequencial que deixava /dashboard/despesas lento.
  const arquivos = await Promise.all(
    (comprovantes ?? []).map(async (c) => {
      const { data: file } = await admin.storage.from(c.storage_bucket).download(c.storage_path);
      if (!file) return null;
      const pasta = pastaPorDespesa.get(c.despesa_id ?? "");
      if (!pasta) return null;
      const rotulo = c.tipo_documento === "comprovante_pagamento" ? "comprovante" : "nota";
      const buffer = Buffer.from(await file.arrayBuffer());
      return {
        caminho: `${pasta}/${rotulo}${extensaoDe(c.nome_arquivo, c.mime_type)}`,
        buffer,
      };
    })
  );

  const zip = new JSZip();
  for (const arquivo of arquivos) {
    if (arquivo) zip.file(arquivo.caminho, arquivo.buffer);
  }

  const totalValor = despesas.reduce((soma, d) => soma + d.valor, 0);
  const linhasResumo = [
    "OryonCash — Lançamentos compartilhados",
    `Gerado em ${formatDataHoraBrasil(new Date().toISOString())}`,
    "",
    ...despesas.map((d) => {
      const pasta = pastaPorDespesa.get(d.id) ?? "";
      const docs = comprovantesPorDespesa.get(d.id) ?? [];
      return [
        `${formatDataBrasil(d.data)} · ${formatBRL(d.valor)} · ${nomeDe(d.obras)} · ${nomeDe(d.categorias)}`,
        `  Descrição: ${d.descricao || "Sem descrição"}`,
        `  Fornecedor: ${nomeDe(d.fornecedores)}`,
        `  Pasta: ${pasta}/ (${docs.length} documento(s))`,
        "",
      ].join("\n");
    }),
    `Total: ${formatBRL(totalValor)} — ${despesas.length} lançamento(s)`,
  ];
  zip.file("resumo.txt", linhasResumo.join("\n"));

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const nomeZip = `oryoncash-lancamentos-${formatDataBrasil(new Date().toISOString()).replace(/\//g, "-")}.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeZip}"`,
    },
  });
}
