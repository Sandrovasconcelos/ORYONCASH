import { createAdminClient } from "@/lib/supabase/admin";
import { formatDataBrasil } from "@/lib/format-date";
import { carregarNotas } from "@/lib/despesas/notas";
import { consultarEmLotes } from "@/lib/supabase/emLotes";

const PALETA_GRUPOS_NOTA = ["#296dd1", "#7c3aed", "#bd7600", "#0f766e", "#c2185b", "#4d7c0f"];

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
  quantidade: number | null;
  valorUnitario: number | null;
  descricao: string | null;
  data: string;
  obraNome: string;
  categoriaNome: string;
  etapaNome: string;
  materialNome: string;
  fornecedorNome: string;
  notaUrl: string | null;
  comprovanteUrl: string | null;
  /** Preenchido quando esta despesa é um dos vários itens de uma mesma nota. */
  notaGrupo: {
    indice: number;
    totalItens: number;
    cor: string;
    totalPago: number;
    valorDesconto: number | null;
    valorItensOriginal: number | null;
  } | null;
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
      "id, valor, quantidade, valor_unitario, descricao, data, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome)"
    )
    .is("deleted_at", null)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (usaSelecaoManual) {
    query = query.in("id", idsSelecionados);
  } else {
    if (filtros.obra) query = query.eq("obra_id", filtros.obra);
    if (filtros.categoria) query = query.eq("categoria_id", filtros.categoria);
    // "etapa" aceita varios ids separados por virgula (mesma etapa em obras diferentes).
    if (filtros.etapa) {
      const idsEtapa = filtros.etapa.split(",").filter(Boolean);
      query = idsEtapa.length > 1 ? query.in("etapa_id", idsEtapa) : query.eq("etapa_id", idsEtapa[0]);
    }
    if (filtros.material) {
      const idsMaterial = filtros.material.split(",").filter(Boolean);
      query = idsMaterial.length > 1 ? query.in("material_id", idsMaterial) : query.eq("material_id", idsMaterial[0]);
    }
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
        ? supabase.from("etapas").select("nome").eq("id", filtros.etapa.split(",")[0]).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && filtros.material
        ? supabase.from("materiais").select("nome").eq("id", filtros.material.split(",")[0]).maybeSingle()
        : Promise.resolve({ data: null }),
      !usaSelecaoManual && filtros.fornecedor
        ? supabase.from("fornecedores").select("nome").eq("id", filtros.fornecedor).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const despesasBrutas = data ?? [];

  const idsDespesas = despesasBrutas.map((d) => d.id);
  const { data: comprovantesData } = await consultarEmLotes(idsDespesas, (lote) =>
    supabase.from("despesa_comprovantes").select("despesa_id, tipo_documento, storage_bucket, storage_path").in("despesa_id", lote)
  );
  // 7 dias em vez de 1 hora - o PDF costuma ser salvo/reaberto ou mandado
  // por WhatsApp bem depois de gerado, entao o link nao pode expirar cedo.
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

  // Varios itens de uma mesma nota viram varias despesas (uma por item), que
  // compartilham o mesmo arquivo em despesa_comprovantes - agrupa visualmente
  // igual na tela de Lançamentos, pra quem olha o relatório (web ou PDF)
  // conseguir ver quais linhas vieram da mesma nota.
  const grupoNotaPorDespesa = new Map<string, { indice: number; totalItens: number; cor: string }>();
  {
    const idsPorChave = new Map<string, string[]>();
    for (const d of despesasBrutas) {
      const comprovantesDaDespesa = (comprovantesData ?? []).filter((c) => c.despesa_id === d.id);
      const arquivoCompartilhado =
        comprovantesDaDespesa.find((c) => c.tipo_documento === "documento_cobranca") ??
        comprovantesDaDespesa.find((c) => c.tipo_documento === "comprovante_pagamento");
      if (!arquivoCompartilhado) continue;
      const chave = `${arquivoCompartilhado.storage_bucket}/${arquivoCompartilhado.storage_path}`;
      const lista = idsPorChave.get(chave) ?? [];
      lista.push(d.id);
      idsPorChave.set(chave, lista);
    }
    let corIndex = 0;
    for (const ids of idsPorChave.values()) {
      if (ids.length < 2) continue;
      const cor = PALETA_GRUPOS_NOTA[corIndex % PALETA_GRUPOS_NOTA.length];
      ids.forEach((despesaId, i) => {
        grupoNotaPorDespesa.set(despesaId, { indice: i + 1, totalItens: ids.length, cor });
      });
      corIndex += 1;
    }
  }
  const notasCompletas = await carregarNotas(idsDespesas);

  const despesas: DespesaRelatorio[] = despesasBrutas.map((d) => {
    const grupo = grupoNotaPorDespesa.get(d.id);
    const notaCompleta = notasCompletas.get(d.id);
    return {
      id: d.id,
      valor: d.valor,
      quantidade: d.quantidade,
      valorUnitario: d.valor_unitario,
      descricao: d.descricao,
      data: d.data,
      obraNome: nomeDe(d.obras),
      categoriaNome: nomeDe(d.categorias),
      etapaNome: nomeDe(d.etapas),
      materialNome: nomeDe(d.materiais),
      fornecedorNome: nomeDe(d.fornecedores),
      notaUrl: documentosPorDespesa.get(d.id)?.nota ?? null,
      comprovanteUrl: documentosPorDespesa.get(d.id)?.comprovante ?? null,
      notaGrupo: grupo
        ? {
            indice: grupo.indice,
            totalItens: notaCompleta?.membros.length ?? grupo.totalItens,
            cor: grupo.cor,
            totalPago: notaCompleta?.total ?? d.valor,
            valorDesconto: notaCompleta?.valorDesconto ?? null,
            valorItensOriginal: notaCompleta?.valorItensOriginal ?? null,
          }
        : null,
    };
  });

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
