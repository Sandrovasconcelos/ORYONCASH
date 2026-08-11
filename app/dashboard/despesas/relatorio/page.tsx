import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { formatDataBrasil, formatDataHoraBrasil } from "@/lib/format-date";
import { ActionIcon, type ActionIconName } from "../../action-icon";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type Filtros = {
  obra?: string;
  categoria?: string;
  etapa?: string;
  material?: string;
  fornecedor?: string;
  ids?: string;
};

function nomeDe(relacao: unknown): string {
  return (relacao as { nome: string } | null)?.nome ?? "Sem classificação";
}

function agregarPorNome(itens: { nome: string; valor: number }[]) {
  const totais = new Map<string, number>();
  for (const item of itens) {
    totais.set(item.nome, (totais.get(item.nome) ?? 0) + item.valor);
  }
  return Array.from(totais.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);
}

function formatPeriodo(dataInicio: string, dataFim: string): string {
  if (dataInicio === dataFim) return formatDataBrasil(dataInicio);

  const [anoInicio, mesInicio] = dataInicio.split("-");
  const [anoFim, mesFim] = dataFim.split("-");
  const fim = formatDataBrasil(dataFim);

  if (anoInicio !== anoFim) {
    return `${formatDataBrasil(dataInicio)} – ${fim}`;
  }
  if (mesInicio !== mesFim) {
    return `${formatDataBrasil(dataInicio).slice(0, 5)} – ${fim}`;
  }
  return `${formatDataBrasil(dataInicio).slice(0, 2)} – ${fim}`;
}

function KpiCard({
  icone,
  label,
  valor,
  destaque,
  compacto,
}: {
  icone: ActionIconName;
  label: string;
  valor: string;
  destaque?: boolean;
  compacto?: boolean;
}) {
  return (
    <div className="report-block rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card print:shadow-none">
      <div className="flex h-[41px] w-[41px] items-center justify-center rounded-brand-sm bg-brand-gray-100 text-brand-gray-700">
        <ActionIcon name={icone} />
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-gray-500">
        {label}
      </p>
      <p
        className={
          compacto
            ? "mt-1 whitespace-nowrap font-display text-base font-black tracking-tight text-brand-black"
            : destaque
              ? "mt-1 font-display text-[23px] font-black tracking-tight text-brand-red"
              : "mt-1 font-display text-[23px] font-black tracking-tight text-brand-black"
        }
      >
        {valor}
      </p>
    </div>
  );
}

function BarraBreakdown({
  nome,
  total,
  totalGeral,
  maior,
}: {
  nome: string;
  total: number;
  totalGeral: number;
  maior: boolean;
}) {
  const percentual = totalGeral > 0 ? (total / totalGeral) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-brand-gray-700">{nome}</span>
        <span className="shrink-0 font-semibold text-brand-black">{formatBRL(total)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-brand-gray-100">
        <div
          className={maior ? "h-2 rounded-full bg-brand-red" : "h-2 rounded-full bg-brand-gray-700/60"}
          style={{ width: `${Math.max(2, Math.min(100, percentual))}%` }}
        />
      </div>
      <p className="text-[11px] text-brand-gray-500">{percentual.toFixed(1)}% do total</p>
    </div>
  );
}

export default async function RelatorioDespesasPage({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const idsSelecionados = (params.ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const usaSelecaoManual = idsSelecionados.length > 0;

  let query = supabase
    .from("despesas")
    .select(
      "id, valor, descricao, data, origem, created_at, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome)"
    )
    .is("deleted_at", null)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (usaSelecaoManual) {
    query = query.in("id", idsSelecionados);
  } else {
    if (params.obra) query = query.eq("obra_id", params.obra);
    if (params.categoria) query = query.eq("categoria_id", params.categoria);
    if (params.etapa) query = query.eq("etapa_id", params.etapa);
    if (params.material) query = query.eq("material_id", params.material);
    if (params.fornecedor) query = query.eq("fornecedor_id", params.fornecedor);
  }

  const [{ data }, obraFiltro, categoriaFiltro, etapaFiltro, materialFiltro, fornecedorFiltro] =
    await Promise.all([
      query,
      !usaSelecaoManual && params.obra
        ? supabase.from("obras").select("nome").eq("id", params.obra).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && params.categoria
        ? supabase.from("categorias").select("nome").eq("id", params.categoria).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && params.etapa
        ? supabase.from("etapas").select("nome").eq("id", params.etapa).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && params.material
        ? supabase.from("materiais").select("nome").eq("id", params.material).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && params.fornecedor
        ? supabase.from("fornecedores").select("nome").eq("id", params.fornecedor).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const despesas = data ?? [];
  const totalGasto = despesas.reduce((soma, d) => soma + d.valor, 0);

  const idsDespesas = despesas.map((d) => d.id);
  const { data: comprovantesData } =
    idsDespesas.length > 0
      ? await supabase
          .from("despesa_comprovantes")
          .select("id, despesa_id, tipo_documento, storage_bucket, storage_path")
          .in("despesa_id", idsDespesas)
      : { data: [] };
  const comprovantesComUrl = await Promise.all(
    (comprovantesData ?? []).map(async (c) => {
      const { data: signed } = await supabase.storage
        .from(c.storage_bucket)
        .createSignedUrl(c.storage_path, 60 * 60);
      return { ...c, url: signed?.signedUrl ?? null };
    })
  );
  const documentosPorDespesa = new Map<
    string,
    { nota: string | null; comprovante: string | null }
  >();
  for (const c of comprovantesComUrl) {
    if (!c.despesa_id) continue;
    const atual = documentosPorDespesa.get(c.despesa_id) ?? { nota: null, comprovante: null };
    if (c.tipo_documento === "comprovante_pagamento") atual.comprovante = c.url;
    else atual.nota = c.url;
    documentosPorDespesa.set(c.despesa_id, atual);
  }
  const quantidade = despesas.length;
  const ticketMedio = quantidade > 0 ? totalGasto / quantidade : 0;

  const datasOrdenadas = despesas.map((d) => d.data).sort();
  const periodo =
    datasOrdenadas.length > 0
      ? formatPeriodo(datasOrdenadas[0], datasOrdenadas[datasOrdenadas.length - 1])
      : "-";

  const porCategoria = agregarPorNome(
    despesas.map((d) => ({ nome: nomeDe(d.categorias), valor: d.valor }))
  ).slice(0, 8);
  const porEtapa = agregarPorNome(
    despesas.map((d) => ({ nome: nomeDe(d.etapas), valor: d.valor }))
  ).slice(0, 8);

  const maiorCategoria = Math.max(0, ...porCategoria.map((c) => c.total));
  const maiorEtapa = Math.max(0, ...porEtapa.map((c) => c.total));

  const filtrosAtivos = usaSelecaoManual
    ? [{ rotulo: "Seleção manual", valor: `${despesas.length} lançamento(s)` }]
    : ([
    params.obra
      ? { rotulo: "Obra", valor: (obraFiltro.data as { nome: string } | null)?.nome ?? "-" }
      : null,
    params.categoria
      ? {
          rotulo: "Categoria",
          valor: (categoriaFiltro.data as { nome: string } | null)?.nome ?? "-",
        }
      : null,
    params.etapa
      ? { rotulo: "Etapa", valor: (etapaFiltro.data as { nome: string } | null)?.nome ?? "-" }
      : null,
    params.material
      ? {
          rotulo: "Material",
          valor: (materialFiltro.data as { nome: string } | null)?.nome ?? "-",
        }
      : null,
    params.fornecedor
      ? {
          rotulo: "Fornecedor",
          valor: (fornecedorFiltro.data as { nome: string } | null)?.nome ?? "-",
        }
      : null,
  ].filter(Boolean) as { rotulo: string; valor: string }[]);

  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][]
  ).toString();

  const geradoEm = formatDataHoraBrasil(new Date().toISOString());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard/despesas${queryString ? `?${queryString}` : ""}`}
          className="text-sm font-semibold text-brand-gray-700 hover:text-brand-red"
        >
          ← Voltar aos lançamentos
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/despesas/relatorio/csv${queryString ? `?${queryString}` : ""}`}
            className="oc-button oc-button-soft"
          >
            Exportar CSV
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="rounded-card border border-brand-gray-300/60 bg-white p-6 shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-8">
        <div className="report-block flex flex-col gap-4 border-b border-brand-gray-300/70 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/oryoncash-simbolo-oficial.png"
              alt=""
              width={265}
              height={250}
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="oc-eyebrow">OryonCash / Financeiro</p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-brand-black">
                Relatório de Despesas
              </h1>
              <p className="mt-0.5 text-xs text-brand-gray-500">Gerado em {geradoEm}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            {filtrosAtivos.length > 0 ? (
              filtrosAtivos.map((filtro) => (
                <span
                  key={filtro.rotulo}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-gray-100 px-3 py-1.5 text-xs font-semibold text-brand-gray-700"
                >
                  <span className="text-brand-gray-500">{filtro.rotulo}:</span> {filtro.valor}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-gray-100 px-3 py-1.5 text-xs font-semibold text-brand-gray-700">
                Todas as obras e categorias
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icone="receipt" label="Total gasto" valor={formatBRL(totalGasto)} destaque />
          <KpiCard icone="layers" label="Lançamentos" valor={String(quantidade)} />
          <KpiCard icone="calculator" label="Ticket médio" valor={formatBRL(ticketMedio)} />
          <KpiCard icone="clock" label="Período" valor={periodo} compacto />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="report-block rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card print:shadow-none">
            <p className="mb-4 text-sm font-semibold text-brand-black">Gasto por categoria</p>
            <div className="flex flex-col gap-4">
              {porCategoria.length > 0 ? (
                porCategoria.map((item) => (
                  <BarraBreakdown
                    key={item.nome}
                    nome={item.nome}
                    total={item.total}
                    totalGeral={totalGasto}
                    maior={item.total === maiorCategoria}
                  />
                ))
              ) : (
                <p className="text-sm text-brand-gray-500">Nenhum registro para exibir.</p>
              )}
            </div>
          </div>

          <div className="report-block rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card print:shadow-none">
            <p className="mb-4 text-sm font-semibold text-brand-black">Gasto por etapa</p>
            <div className="flex flex-col gap-4">
              {porEtapa.length > 0 ? (
                porEtapa.map((item) => (
                  <BarraBreakdown
                    key={item.nome}
                    nome={item.nome}
                    total={item.total}
                    totalGeral={totalGasto}
                    maior={item.total === maiorEtapa}
                  />
                ))
              ) : (
                <p className="text-sm text-brand-gray-500">Nenhum registro para exibir.</p>
              )}
            </div>
          </div>
        </div>

        <div className="oc-table-wrap mt-6 print:shadow-none">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="oc-table w-full min-w-[880px] print:min-w-0 print:table-fixed">
              <thead>
                <tr>
                  <th className="print:w-[8%]">Data</th>
                  <th className="print:w-[12%]">Obra</th>
                  <th className="print:w-[11%]">Categoria</th>
                  <th className="print:w-[11%]">Etapa</th>
                  <th className="print:w-[12%]">Material</th>
                  <th className="print:w-[12%]">Fornecedor</th>
                  <th className="print:w-[22%]">Descrição</th>
                  <th className="text-right print:w-[12%]">Valor</th>
                  <th className="print:hidden">Documentos</th>
                </tr>
              </thead>
              <tbody>
                {despesas.map((d) => {
                  const documentos = documentosPorDespesa.get(d.id);
                  return (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap">{formatDataBrasil(d.data)}</td>
                      <td className="print:truncate">{nomeDe(d.obras)}</td>
                      <td className="print:truncate">{nomeDe(d.categorias)}</td>
                      <td className="print:truncate">{nomeDe(d.etapas)}</td>
                      <td className="print:truncate">{nomeDe(d.materiais)}</td>
                      <td className="print:truncate">{nomeDe(d.fornecedores)}</td>
                      <td className="max-w-[220px] truncate">{d.descricao ?? "-"}</td>
                      <td className="text-right font-semibold">{formatBRL(d.valor)}</td>
                      <td className="print:hidden">
                        <div className="flex flex-col gap-1 whitespace-nowrap text-xs font-semibold">
                          {documentos?.nota && (
                            <a
                              href={documentos.nota}
                              target="_blank"
                              rel="noreferrer"
                              className="text-status-info hover:underline"
                            >
                              📄 Nota
                            </a>
                          )}
                          {documentos?.comprovante && (
                            <a
                              href={documentos.comprovante}
                              target="_blank"
                              rel="noreferrer"
                              className="text-status-success hover:underline"
                            >
                              💳 Comprovante
                            </a>
                          )}
                          {!documentos?.nota && !documentos?.comprovante && (
                            <span className="text-brand-gray-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {despesas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="oc-empty">
                      Nenhuma despesa encontrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
              {despesas.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={7} className="text-right font-bold uppercase tracking-[0.08em] text-brand-gray-500">
                      Total
                    </td>
                    <td className="text-right font-display text-base font-black text-brand-red">
                      {formatBRL(totalGasto)}
                    </td>
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-brand-gray-500">
          Documento gerado automaticamente pelo OryonCash em {geradoEm}. Não substitui nota fiscal
          ou comprovante de pagamento.
        </p>
      </div>
    </div>
  );
}
