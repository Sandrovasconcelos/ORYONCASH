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
  fornecedores: CategoriaBreakdown[];
  comparativoObras: CategoriaBreakdown[];
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

/**
 * Agrupa por dia quando o periodo coberto pelos lancamentos e curto (obra
 * recente, poucos dias de uso) - agrupar por mes nesse caso renderizaria um
 * grafico de tendencia com um unico ponto. A partir de ~45 dias de intervalo
 * volta a agrupar por mes, que fica mais legivel conforme o historico cresce.
 */
function agruparTendencia(despesas: { valor: number; data: string }[]): PontoTendencia[] {
  if (despesas.length === 0) return [];

  const datasOrdenadas = despesas.map((d) => d.data).sort();
  const primeira = new Date(datasOrdenadas[0]);
  const ultima = new Date(datasOrdenadas[datasOrdenadas.length - 1]);
  const diasDeSpan = Math.round(
    (ultima.getTime() - primeira.getTime()) / (1000 * 60 * 60 * 24)
  );
  const porDia = diasDeSpan <= 45;

  const totais = new Map<string, number>();
  for (const d of despesas) {
    const chave = porDia ? d.data : d.data.slice(0, 7);
    totais.set(chave, (totais.get(chave) ?? 0) + d.valor);
  }

  return Array.from(totais.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, valor]) => {
      if (porDia) {
        const [, mes, dia] = chave.split("-");
        return { mes: `${dia}/${mes}`, valor };
      }
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

function agruparFornecedores(
  despesas: { valor: number; fornecedor_id: string | null }[],
  fornecedoresCatalogo: { id: string; nome: string }[],
  gastoTotal: number
): CategoriaBreakdown[] {
  const totais = new Map<string, number>();
  for (const d of despesas) {
    if (!d.fornecedor_id) continue;
    totais.set(d.fornecedor_id, (totais.get(d.fornecedor_id) ?? 0) + d.valor);
  }
  if (totais.size === 0) return [];

  const nomesPorId = new Map(fornecedoresCatalogo.map((f) => [f.id, f.nome]));
  const maiorTotal = Math.max(0, ...Array.from(totais.values()));

  return Array.from(totais.entries())
    .map(([id, total]) => ({
      id,
      nome: nomesPorId.get(id) ?? "Fornecedor removido",
      total,
      percentual: gastoTotal > 0 ? (total / gastoTotal) * 100 : 0,
      maiorGasto: total > 0 && total === maiorTotal,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

function agruparComparativoObras(
  despesas: { valor: number; obra_id: string }[],
  obrasCatalogo: { id: string; nome: string }[]
): CategoriaBreakdown[] {
  const totais = new Map<string, number>();
  for (const d of despesas) {
    totais.set(d.obra_id, (totais.get(d.obra_id) ?? 0) + d.valor);
  }

  const gastoGeral = Array.from(totais.values()).reduce((soma, v) => soma + v, 0);
  const maiorTotal = Math.max(0, ...Array.from(totais.values()));

  return obrasCatalogo
    .map((obra) => {
      const total = totais.get(obra.id) ?? 0;
      return {
        id: obra.id,
        nome: obra.nome,
        total,
        percentual: gastoGeral > 0 ? (total / gastoGeral) * 100 : 0,
        maiorGasto: total > 0 && total === maiorTotal,
      };
    })
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
      fornecedores: [],
      comparativoObras: [],
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
    { data: fornecedoresCatalogo },
    { data: despesasTodasObras },
  ] = await Promise.all([
    supabase
      .from("despesas")
      .select("valor, categoria_id, etapa_id, material_id, fornecedor_id, data")
      .is("deleted_at", null)
      .eq("obra_id", obraSelecionada.id),
    supabase.from("categorias").select("id, nome").is("deleted_at", null).order("nome"),
    supabase
      .from("etapas")
      .select("id, nome, valor_orcado")
      .eq("obra_id", obraSelecionada.id)
      .order("ordem"),
    supabase.from("materiais").select("id, nome").is("deleted_at", null),
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null),
    supabase.from("despesas").select("obra_id, valor").is("deleted_at", null),
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

  const fornecedorBreakdown = agruparFornecedores(
    (despesas ?? []).map((d) => ({ valor: d.valor, fornecedor_id: d.fornecedor_id })),
    fornecedoresCatalogo ?? [],
    gastoTotal
  );

  const comparativoObras = agruparComparativoObras(
    despesasTodasObras ?? [],
    listaObras
  );

  const tendenciaMensal = agruparTendencia(
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
    fornecedores: fornecedorBreakdown,
    comparativoObras,
    tendenciaMensal,
  };
}

// ---------- Medições ----------

export type EtapaParaMedicao = {
  id: string;
  nome: string;
  valorOrcado: number;
  percentualExecutado: number;
  situacaoQualidade: string;
  fornecedorId: string | null;
};

export type ItemMedicaoElegivel = {
  etapaId: string;
  etapaNome: string;
  fornecedorId: string;
  percentualMedido: number;
  valorMedido: number;
};

/**
 * So mede o que ja foi executado E aprovado pela qualidade. percentualMedido
 * e sempre o delta desde a ultima medicao daquela etapa (nao o acumulado),
 * senao a mesma execucao seria paga de novo a cada medicao.
 */
export function calcularItensElegiveisParaMedicao(
  etapas: EtapaParaMedicao[],
  percentualJaMedidoPorEtapa: Map<string, number>
): ItemMedicaoElegivel[] {
  const itens: ItemMedicaoElegivel[] = [];

  for (const etapa of etapas) {
    if (etapa.situacaoQualidade !== "aprovado") continue;
    if (!etapa.fornecedorId) continue;

    const jaMedido = percentualJaMedidoPorEtapa.get(etapa.id) ?? 0;
    const delta = etapa.percentualExecutado - jaMedido;
    if (delta <= 0) continue;

    const valorMedido = Number(((etapa.valorOrcado * delta) / 100).toFixed(2));
    if (valorMedido <= 0) continue;

    itens.push({
      etapaId: etapa.id,
      etapaNome: etapa.nome,
      fornecedorId: etapa.fornecedorId,
      percentualMedido: delta,
      valorMedido,
    });
  }

  return itens;
}

// ---------- Curva S ----------

export type PontoCurvaS = { mes: string; previsto: number; realizado: number };

type EtapaParaCurvaS = {
  valorOrcado: number;
  dataInicioPrevista: string | null;
  dataFimPrevista: string | null;
};

type DespesaParaCurvaS = { valor: number; data: string };

function parseDataISO(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function fimDoMes(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0));
}

/**
 * Curva S financeira (previsto x realizado acumulado por mes). O previsto
 * distribui o valor orcado de cada etapa linearmente entre sua data de
 * inicio e fim previstas (aproximacao padrao quando nao ha cronograma de
 * desembolso detalhado). O realizado soma despesas ate o fim de cada mes.
 */
export function calcularCurvaS(
  etapas: EtapaParaCurvaS[],
  despesas: DespesaParaCurvaS[]
): PontoCurvaS[] {
  const etapasComData = etapas
    .filter((e) => e.dataInicioPrevista && e.dataFimPrevista)
    .map((e) => ({
      valorOrcado: e.valorOrcado,
      inicio: parseDataISO(e.dataInicioPrevista as string),
      fim: parseDataISO(e.dataFimPrevista as string),
    }));

  const datasDespesas = despesas.map((d) => parseDataISO(d.data));

  const todasAsDatas = [
    ...etapasComData.flatMap((e) => [e.inicio, e.fim]),
    ...datasDespesas,
  ];
  if (todasAsDatas.length === 0) return [];

  const inicioRange = new Date(Math.min(...todasAsDatas.map((d) => d.getTime())));
  const fimRange = new Date(Math.max(...todasAsDatas.map((d) => d.getTime())));

  const pontos: PontoCurvaS[] = [];
  const cursor = new Date(Date.UTC(inicioRange.getUTCFullYear(), inicioRange.getUTCMonth(), 1));
  while (cursor <= fimRange) {
    const fimMes = fimDoMes(cursor);

    let previsto = 0;
    for (const etapa of etapasComData) {
      if (fimMes < etapa.inicio) continue;
      if (fimMes >= etapa.fim) {
        previsto += etapa.valorOrcado;
        continue;
      }
      const duracaoTotal = etapa.fim.getTime() - etapa.inicio.getTime() || 1;
      const decorrido = fimMes.getTime() - etapa.inicio.getTime();
      previsto += etapa.valorOrcado * Math.max(0, Math.min(1, decorrido / duracaoTotal));
    }

    let realizado = 0;
    for (let i = 0; i < despesas.length; i++) {
      if (datasDespesas[i] <= fimMes) realizado += despesas[i].valor;
    }

    pontos.push({
      mes: `${NOMES_MES[cursor.getUTCMonth()]}/${String(cursor.getUTCFullYear()).slice(2)}`,
      previsto: Number(previsto.toFixed(2)),
      realizado: Number(realizado.toFixed(2)),
    });

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return pontos;
}
