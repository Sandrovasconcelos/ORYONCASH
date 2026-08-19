import { createAdminClient } from "@/lib/supabase/admin";
import { formatDataBrasil } from "@/lib/format-date";

export type FiltrosRelatorio = {
  obra?: string;
  categoria?: string;
  etapa?: string;
  material?: string;
  fornecedor?: string;
  ids?: string;
  dataInicio?: string;
  dataFim?: string;
};

export type DespesaRelatorio = {
  id: string;
  valor: number;
  descricao: string | null;
  data: string;
  obraNome: string;
  categoriaNome: string;
  etapaNome: string;
  materialNome: string;
  fornecedorNome: string;
};

export type DadosRelatorio = {
  despesas: DespesaRelatorio[];
  totalGasto: number;
  quantidade: number;
  ticketMedio: number;
  periodo: string;
  porCategoria: { nome: string; total: number }[];
  porEtapa: { nome: string; total: number }[];
  filtrosAtivos: { rotulo: string; valor: string }[];
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

  if (anoInicio !== anoFim) return `${formatDataBrasil(dataInicio)} – ${fim}`;
  if (mesInicio !== mesFim) return `${formatDataBrasil(dataInicio).slice(0, 5)} – ${fim}`;
  return `${formatDataBrasil(dataInicio).slice(0, 2)} – ${fim}`;
}

/**
 * Fonte unica de verdade pros dados do relatorio de despesas - usada tanto
 * pela pagina web (app/dashboard/despesas/relatorio/page.tsx) quanto pelo
 * gerador de PDF (lib/relatorio/pdf.tsx), pra nao ter duas logicas de
 * filtro/agregacao que podem divergir.
 */
export async function buscarDadosRelatorio(filtros: FiltrosRelatorio): Promise<DadosRelatorio> {
  const supabase = createAdminClient();

  const idsSelecionados = (filtros.ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const usaSelecaoManual = idsSelecionados.length > 0;

  let query = supabase
    .from("despesas")
    .select(
      "id, valor, descricao, data, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome)"
    )
    .is("deleted_at", null)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (usaSelecaoManual) {
    query = query.in("id", idsSelecionados);
  } else {
    if (filtros.obra) query = query.eq("obra_id", filtros.obra);
    if (filtros.categoria) query = query.eq("categoria_id", filtros.categoria);
    if (filtros.etapa) query = query.eq("etapa_id", filtros.etapa);
    if (filtros.material) query = query.eq("material_id", filtros.material);
    if (filtros.fornecedor) query = query.eq("fornecedor_id", filtros.fornecedor);
    if (filtros.dataInicio) query = query.gte("data", filtros.dataInicio);
    if (filtros.dataFim) query = query.lte("data", filtros.dataFim);
  }

  const [{ data }, obraFiltro, categoriaFiltro, etapaFiltro, materialFiltro, fornecedorFiltro] =
    await Promise.all([
      query,
      !usaSelecaoManual && filtros.obra
        ? supabase.from("obras").select("nome").eq("id", filtros.obra).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && filtros.categoria
        ? supabase.from("categorias").select("nome").eq("id", filtros.categoria).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && filtros.etapa
        ? supabase.from("etapas").select("nome").eq("id", filtros.etapa).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && filtros.material
        ? supabase.from("materiais").select("nome").eq("id", filtros.material).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && filtros.fornecedor
        ? supabase.from("fornecedores").select("nome").eq("id", filtros.fornecedor).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const despesasBrutas = data ?? [];
  const despesas: DespesaRelatorio[] = despesasBrutas.map((d) => ({
    id: d.id,
    valor: d.valor,
    descricao: d.descricao,
    data: d.data,
    obraNome: nomeDe(d.obras),
    categoriaNome: nomeDe(d.categorias),
    etapaNome: nomeDe(d.etapas),
    materialNome: nomeDe(d.materiais),
    fornecedorNome: nomeDe(d.fornecedores),
  }));

  const totalGasto = despesas.reduce((soma, d) => soma + d.valor, 0);
  const quantidade = despesas.length;
  const ticketMedio = quantidade > 0 ? totalGasto / quantidade : 0;

  const datasOrdenadas = despesas.map((d) => d.data).sort();
  const periodo =
    datasOrdenadas.length > 0
      ? formatPeriodo(datasOrdenadas[0], datasOrdenadas[datasOrdenadas.length - 1])
      : "-";

  const porCategoria = agregarPorNome(despesas.map((d) => ({ nome: d.categoriaNome, valor: d.valor }))).slice(
    0,
    8
  );
  const porEtapa = agregarPorNome(despesas.map((d) => ({ nome: d.etapaNome, valor: d.valor }))).slice(0, 8);

  const filtrosAtivos = usaSelecaoManual
    ? [{ rotulo: "Seleção manual", valor: `${despesas.length} lançamento(s)` }]
    : ([
        filtros.obra
          ? { rotulo: "Obra", valor: (obraFiltro.data as { nome: string } | null)?.nome ?? "-" }
          : null,
        filtros.categoria
          ? { rotulo: "Categoria", valor: (categoriaFiltro.data as { nome: string } | null)?.nome ?? "-" }
          : null,
        filtros.etapa
          ? { rotulo: "Etapa", valor: (etapaFiltro.data as { nome: string } | null)?.nome ?? "-" }
          : null,
        filtros.material
          ? { rotulo: "Material", valor: (materialFiltro.data as { nome: string } | null)?.nome ?? "-" }
          : null,
        filtros.fornecedor
          ? { rotulo: "Fornecedor", valor: (fornecedorFiltro.data as { nome: string } | null)?.nome ?? "-" }
          : null,
        filtros.dataInicio || filtros.dataFim
          ? {
              rotulo: "Período filtrado",
              valor:
                filtros.dataInicio && filtros.dataFim
                  ? `${formatDataBrasil(filtros.dataInicio)} a ${formatDataBrasil(filtros.dataFim)}`
                  : filtros.dataInicio
                    ? `A partir de ${formatDataBrasil(filtros.dataInicio)}`
                    : `Até ${formatDataBrasil(filtros.dataFim!)}`,
            }
          : null,
      ].filter(Boolean) as { rotulo: string; valor: string }[]);

  return { despesas, totalGasto, quantidade, ticketMedio, periodo, porCategoria, porEtapa, filtrosAtivos };
}
