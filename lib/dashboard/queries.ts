import { createClient } from "@/lib/supabase/server";

export type ObraResumida = { id: string; nome: string; status: string };

export type CategoriaBreakdown = {
  id: string;
  nome: string;
  total: number;
  percentual: number;
  maiorGasto: boolean;
};

export type EtapaBreakdown = CategoriaBreakdown & {
  valorOrcado: number | null;
  estourado: boolean;
};

export type PontoTendencia = { mes: string; valor: number };

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
  materiais: CategoriaBreakdown[];
  tendenciaMensal: PontoTendencia[];
};

const NOMES_MES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function agruparPorMes(despesas: { valor: number; data: string }[]): PontoTendencia[] {
  const totais = new Map<string, number>();
  for (const d of despesas) {
    const [ano, mes] = d.data.split("-");
    const chave = `${ano}-${mes}`;
    totais.set(chave, (totais.get(chave) ?? 0) + d.valor);
  }

  return Array.from(totais.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, valor]) => {
      const [ano, mes] = chave.split("-");
      return { mes: `${NOMES_MES[Number(mes) - 1]}/${ano.slice(2)}`, valor };
    });
}

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

function agruparEtapas(
  despesas: { valor: number; ref_id: string | null }[],
  catalogo: { id: string; nome: string; valor_orcado: number | null }[],
  gastoTotal: number
): EtapaBreakdown[] {
  const base = agruparPorId(despesas, catalogo, gastoTotal);
  const orcadoPorId = new Map(catalogo.map((c) => [c.id, c.valor_orcado]));

  return base.map((item) => {
    const valorOrcado = orcadoPorId.get(item.id) ?? null;
    return {
      ...item,
      valorOrcado,
      estourado: valorOrcado !== null && valorOrcado > 0 && item.total > valorOrcado,
    };
  });
}

function agruparMateriais(
  despesas: { valor: number; material_id: string | null }[],
  materiaisCatalogo: { id: string; nome: string }[],
  gastoTotal: number
): CategoriaBreakdown[] {
  const totais = new Map<string, number>();
  for (const d of despesas) {
    if (!d.material_id) continue;
    totais.set(d.material_id, (totais.get(d.material_id) ?? 0) + d.valor);
  }
  if (totais.size === 0) return [];

  const nomesPorId = new Map(materiaisCatalogo.map((m) => [m.id, m.nome]));
  const maiorTotal = Math.max(0, ...Array.from(totais.values()));

  return Array.from(totais.entries())
    .map(([id, total]) => ({
      id,
      nome: nomesPorId.get(id) ?? "Material removido",
      total,
      percentual: gastoTotal > 0 ? (total / gastoTotal) * 100 : 0,
      maiorGasto: total > 0 && total === maiorTotal,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getDashboardData(
  obraIdSolicitada: string | null
): Promise<DashboardData> {
  const supabase = await createClient();

  const obrasComLixeira = await supabase
    .from("obras")
    .select("id, nome, status")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: obras } = obrasComLixeira.error
    ? await supabase
        .from("obras")
        .select("id, nome, status")
        .order("created_at", { ascending: false })
    : obrasComLixeira;

  const listaObras = obras ?? [];
  const obraSelecionada =
    listaObras.find((o) => o.id === obraIdSolicitada) ?? listaObras[0] ?? null;

  if (!obraSelecionada) {
    return {
      obras: listaObras,
      obraAtual: null,
      categorias: [],
      etapas: [],
      materiais: [],
      tendenciaMensal: [],
    };
  }

  const obraComLixeira = await supabase
    .from("obras")
    .select("id, nome, orcamento_total")
    .eq("id", obraSelecionada.id)
    .is("deleted_at", null)
    .maybeSingle();

  const { data: obra } = obraComLixeira.error
    ? await supabase
        .from("obras")
        .select("id, nome, orcamento_total")
        .eq("id", obraSelecionada.id)
        .maybeSingle()
    : obraComLixeira;

  const [
    { data: despesas },
    { data: categorias },
    { data: etapasProprias },
    { data: materiaisCatalogo },
  ] = await Promise.all([
    supabase
      .from("despesas")
      .select("valor, categoria_id, etapa_id, material_id, data")
      .is("deleted_at", null)
      .eq("obra_id", obraSelecionada.id),
    supabase.from("categorias").select("id, nome").is("deleted_at", null).order("nome"),
    supabase
      .from("etapas")
      .select("id, nome, valor_orcado")
      .eq("obra_id", obraSelecionada.id)
      .order("ordem"),
    supabase.from("materiais").select("id, nome").is("deleted_at", null),
  ]);

  let etapasCatalogo = etapasProprias ?? [];
  if (etapasCatalogo.length === 0) {
    const { data: etapasGenericas } = await supabase
      .from("etapas")
      .select("id, nome, valor_orcado")
      .is("obra_id", null)
      .order("ordem");
    etapasCatalogo = etapasGenericas ?? [];
  }

  const gastoTotal = (despesas ?? []).reduce((sum, d) => sum + d.valor, 0);
  const orcamentoTotal = obra?.orcamento_total ?? 0;

  const categoriaBreakdown = agruparPorId(
    (despesas ?? []).map((d) => ({ valor: d.valor, ref_id: d.categoria_id })),
    categorias ?? [],
    gastoTotal
  );

  const etapaBreakdown = agruparEtapas(
    (despesas ?? []).map((d) => ({ valor: d.valor, ref_id: d.etapa_id })),
    etapasCatalogo,
    gastoTotal
  );

  const materialBreakdown = agruparMateriais(
    (despesas ?? []).map((d) => ({ valor: d.valor, material_id: d.material_id })),
    materiaisCatalogo ?? [],
    gastoTotal
  );

  const tendenciaMensal = agruparPorMes(
    (despesas ?? []).map((d) => ({ valor: d.valor, data: d.data }))
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
    materiais: materialBreakdown,
    tendenciaMensal,
  };
}
