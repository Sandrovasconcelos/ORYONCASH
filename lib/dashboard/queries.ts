import { createClient } from "@/lib/supabase/server";

export type ObraResumida = { id: string; nome: string; status: string };

export type CategoriaBreakdown = {
  id: string;
  nome: string;
  total: number;
  percentual: number;
  maiorGasto: boolean;
};

export type EtapaBreakdown = CategoriaBreakdown;

export type DashboardData = {
  obras: ObraResumida[];
  obraAtual: {
    id: string;
    nome: string;
    orcamentoTotal: number;
    gastoTotal: number;
    saldoRestante: number;
    percentualInvestido: number;
  } | null;
  categorias: CategoriaBreakdown[];
  etapas: EtapaBreakdown[];
};

function agruparPorId(
  despesas: { valor: number; ref_id: string | null }[],
  catalogo: { id: string; nome: string }[],
  gastoTotal: number
): CategoriaBreakdown[] {
  const totais = new Map<string, number>();
  for (const d of despesas) {
    if (!d.ref_id) continue;
    totais.set(d.ref_id, (totais.get(d.ref_id) ?? 0) + d.valor);
  }

  const maiorTotal = Math.max(0, ...Array.from(totais.values()));

  return catalogo.map((item) => {
    const total = totais.get(item.id) ?? 0;
    return {
      id: item.id,
      nome: item.nome,
      total,
      percentual: gastoTotal > 0 ? (total / gastoTotal) * 100 : 0,
      maiorGasto: total > 0 && total === maiorTotal,
    };
  });
}

export async function getDashboardData(
  obraIdSolicitada: string | null
): Promise<DashboardData> {
  const supabase = await createClient();

  const { data: obras } = await supabase
    .from("obras")
    .select("id, nome, status")
    .order("created_at", { ascending: false });

  const listaObras = obras ?? [];
  const obraSelecionada =
    listaObras.find((o) => o.id === obraIdSolicitada) ?? listaObras[0] ?? null;

  if (!obraSelecionada) {
    return { obras: listaObras, obraAtual: null, categorias: [], etapas: [] };
  }

  const [{ data: obra }, { data: despesas }, { data: categorias }, { data: etapas }] =
    await Promise.all([
      supabase
        .from("obras")
        .select("id, nome, orcamento_total")
        .eq("id", obraSelecionada.id)
        .single(),
      supabase
        .from("despesas")
        .select("valor, categoria_id, etapa_id")
        .eq("obra_id", obraSelecionada.id),
      supabase.from("categorias").select("id, nome").order("nome"),
      supabase.from("etapas").select("id, nome").order("ordem"),
    ]);

  const gastoTotal = (despesas ?? []).reduce((sum, d) => sum + d.valor, 0);
  const orcamentoTotal = obra?.orcamento_total ?? 0;

  const categoriaBreakdown = agruparPorId(
    (despesas ?? []).map((d) => ({ valor: d.valor, ref_id: d.categoria_id })),
    categorias ?? [],
    gastoTotal
  );

  const etapaBreakdown = agruparPorId(
    (despesas ?? []).map((d) => ({ valor: d.valor, ref_id: d.etapa_id })),
    etapas ?? [],
    gastoTotal
  );

  return {
    obras: listaObras,
    obraAtual: {
      id: obraSelecionada.id,
      nome: obra?.nome ?? obraSelecionada.nome,
      orcamentoTotal,
      gastoTotal,
      saldoRestante: orcamentoTotal - gastoTotal,
      percentualInvestido:
        orcamentoTotal > 0 ? (gastoTotal / orcamentoTotal) * 100 : 0,
    },
    categorias: categoriaBreakdown,
    etapas: etapaBreakdown,
  };
}
