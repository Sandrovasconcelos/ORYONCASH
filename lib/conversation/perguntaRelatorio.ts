import { buscarDadosRelatorio, type DespesaRelatorio, type FiltrosRelatorio } from "@/lib/relatorio/dados";
import {
  interpretarPerguntaRelatorio,
  type PeriodoRelativo,
  type TipoFiltroRelatorio,
} from "@/lib/gemini/interpretarPerguntaRelatorio";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/messages";
import { gerarEEnviarRelatorioPorPergunta } from "./relatorio";
import { agruparPorNome, candidatosPorPista } from "./agruparPorNome";
import { hojeNoBrasil } from "./queries";

type Cadastro = { id: string; nome: string };

/**
 * Todos os cadastros de uma tabela, sem o teto de 60 itens das listas do
 * chat (essas existem por causa do limite de botoes do WhatsApp) - aqui a
 * busca e so por nome, entao precisa enxergar tudo.
 */
async function carregarTodos(tabela: "categorias" | "materiais" | "fornecedores" | "etapas" | "obras"): Promise<Cadastro[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from(tabela).select("id, nome").is("deleted_at", null).limit(5000);
  return data ?? [];
}

// Ve se vale a pena chamar o Gemini (que custa tempo/dinheiro) antes de
// qualquer coisa - so passa quem tem cara de pergunta de gasto. O Gemini
// ainda confirma de verdade (ehPerguntaDeGasto) pra nao disparar em falso.
const PARECE_PERGUNTA_DE_GASTO = /gast\w*/;
const TEM_PALAVRA_DE_PERGUNTA = /\b(quanto|quanta|quantos|quantas|qual|quais|quem|total)\b/;

/**
 * Resolve um periodo relativo ("semana_atual", "mes_passado"...) pra datas
 * reais - em codigo, nao pedindo pro Gemini calcular dia da semana/mes (IA
 * erra conta de data com frequencia maior do que o aceitavel aqui).
 */
function resolverPeriodo(
  periodo: PeriodoRelativo | null,
  personalizada: { dataInicio: string | null; dataFim: string | null }
): { dataInicio?: string; dataFim?: string } {
  if (!periodo) return {};
  if (periodo === "personalizado") {
    return { dataInicio: personalizada.dataInicio ?? undefined, dataFim: personalizada.dataFim ?? undefined };
  }

  const hoje = hojeNoBrasil();
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const paraIso = (d: Date) => d.toISOString().slice(0, 10);

  if (periodo === "hoje") return { dataInicio: hoje, dataFim: hoje };

  if (periodo === "ontem") {
    const ontem = paraIso(new Date(Date.UTC(ano, mes - 1, dia - 1)));
    return { dataInicio: ontem, dataFim: ontem };
  }

  if (periodo === "semana_atual") {
    const dataAtual = new Date(Date.UTC(ano, mes - 1, dia));
    const diaDaSemana = dataAtual.getUTCDay(); // 0 = domingo
    const diasDesdeSegunda = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
    const segunda = new Date(dataAtual);
    segunda.setUTCDate(dataAtual.getUTCDate() - diasDesdeSegunda);
    return { dataInicio: paraIso(segunda), dataFim: hoje };
  }

  if (periodo === "mes_atual") return { dataInicio: `${ano}-${pad(mes)}-01`, dataFim: hoje };

  if (periodo === "mes_passado") {
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anoDoMesAnterior = mes === 1 ? ano - 1 : ano;
    const ultimoDia = new Date(Date.UTC(anoDoMesAnterior, mesAnterior, 0)).getUTCDate();
    return {
      dataInicio: `${anoDoMesAnterior}-${pad(mesAnterior)}-01`,
      dataFim: `${anoDoMesAnterior}-${pad(mesAnterior)}-${pad(ultimoDia)}`,
    };
  }

  if (periodo === "ano_atual") return { dataInicio: `${ano}-01-01`, dataFim: hoje };

  return {};
}

type Resolucao =
  | { tipo: "ok"; filtro: Partial<FiltrosRelatorio>; contexto: string }
  | { tipo: "ambiguo"; opcoes: string[] };

/**
 * Casa o termo com os cadastros de UMA dimensao. Material parecido e somado
 * (todos os "vergalhao" juntos); nas demais, mais de um candidato vira
 * pergunta pro usuario em vez de chute.
 */
export async function tentarDimensao(tipo: TipoFiltroRelatorio, termo: string): Promise<Resolucao | null> {
  switch (tipo) {
    case "material": {
      const achados = candidatosPorPista(await carregarTodos("materiais"), termo, false);
      if (achados.length === 0) return null;
      return {
        tipo: "ok",
        filtro: { material: achados.map((m) => m.id).join(",") },
        contexto: achados.length === 1 ? achados[0].nome : `${termo.trim()} (${achados.length} itens)`,
      };
    }
    case "etapa": {
      // a mesma etapa existe uma vez por obra: soma todas
      const achados = candidatosPorPista(agruparPorNome(await carregarTodos("etapas")), termo);
      if (achados.length === 0) return null;
      if (achados.length > 1) return { tipo: "ambiguo", opcoes: achados.map((e) => e.nome) };
      return { tipo: "ok", filtro: { etapa: achados[0].ids.join(",") }, contexto: achados[0].nome };
    }
    case "categoria":
    case "fornecedor":
    case "obra": {
      const tabela = tipo === "categoria" ? "categorias" : tipo === "fornecedor" ? "fornecedores" : "obras";
      const achados = candidatosPorPista(await carregarTodos(tabela), termo);
      if (achados.length === 0) return null;
      if (achados.length > 1) return { tipo: "ambiguo", opcoes: achados.map((a) => a.nome) };
      return { tipo: "ok", filtro: { [tipo]: achados[0].id }, contexto: achados[0].nome };
    }
    default:
      return null;
  }
}

const TODAS_DIMENSOES: TipoFiltroRelatorio[] = ["categoria", "material", "fornecedor", "etapa", "obra"];

/**
 * Tenta primeiro a dimensao que o Gemini sugeriu e, se nao achar nada,
 * tenta as outras - a classificacao de tipo erra de vez em quando (ex:
 * "mão de obra do Alex" virar "fornecedor" em vez de "categoria"), mas o
 * nome buscado geralmente so bate em UM cadastro mesmo testando todas as
 * listas, entao vale tentar antes de desistir. Ambiguidade para na hora
 * (melhor perguntar do que cair em outra dimensao por acaso).
 */
async function resolverDimensao(tipoSugerido: TipoFiltroRelatorio, termo: string): Promise<Resolucao | null> {
  const ordem = [tipoSugerido, ...TODAS_DIMENSOES.filter((tipo) => tipo !== tipoSugerido)];
  for (const tipo of ordem) {
    const resolvido = await tentarDimensao(tipo, termo);
    if (resolvido) return resolvido;
  }
  return null;
}

function nomeParaRanking(despesa: DespesaRelatorio, tipo: TipoFiltroRelatorio): string {
  switch (tipo) {
    case "categoria":
      return despesa.categoriaNome;
    case "material":
      return despesa.materialNome;
    case "fornecedor":
      return despesa.fornecedorNome;
    case "etapa":
      return despesa.etapaNome;
    case "obra":
      return despesa.obraNome;
    default:
      return "-";
  }
}

/**
 * "Qual fornecedor mais gastou", "quem mais recebeu esse mês" etc: busca
 * TODAS as despesas do periodo (sem filtrar por nome, que e justamente o
 * que queremos descobrir), agrupa pelo campo da dimensao pedida e pega o
 * maior - depois resolve esse nome vencedor pra um id de verdade, pra poder
 * gerar o PDF filtrado so com ele.
 */
async function resolverRanking(
  tipo: TipoFiltroRelatorio,
  periodo: { dataInicio?: string; dataFim?: string }
): Promise<{ filtro: Partial<FiltrosRelatorio>; contexto: string; ranking: { nome: string; total: number }[] } | null> {
  const dados = await buscarDadosRelatorio(periodo);
  if (dados.despesas.length === 0) return null;

  const totais = new Map<string, number>();
  for (const despesa of dados.despesas) {
    const nome = nomeParaRanking(despesa, tipo);
    // "Sem classificação" e so o rotulo de quando o campo esta vazio - nao
    // existe como cadastro de verdade, entao nao da pra resolver pra um
    // filtro depois (nem faz sentido no ranking).
    if (nome === "Sem classificação") continue;
    totais.set(nome, (totais.get(nome) ?? 0) + despesa.valor);
  }
  const ranking = [...totais.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);
  if (ranking.length === 0) return null;

  const vencedor = ranking[0];
  const resolvido = await tentarDimensao(tipo, vencedor.nome);
  if (!resolvido || resolvido.tipo !== "ok") return null;

  return { filtro: resolvido.filtro, contexto: vencedor.nome, ranking };
}

/**
 * Tenta tratar uma mensagem livre como pergunta de gasto ("quanto gastei
 * com cimento?", "qual fornecedor mais gastou essa semana?") e, se for,
 * manda um resumo em texto seguido do relatório em PDF já filtrado. So
 * chamada quando o usuario esta no menu (texto livre sem fluxo em
 * andamento) - ver handleMenu em engine.ts.
 */
export async function tentarRelatorioPorPergunta(from: string, texto: string | null): Promise<boolean> {
  const t = texto?.trim();
  if (!t || t.length < 6) return false;
  const minusculo = t.toLowerCase();
  if (!PARECE_PERGUNTA_DE_GASTO.test(minusculo) || !TEM_PALAVRA_DE_PERGUNTA.test(minusculo)) return false;

  try {
    const interpretacao = await interpretarPerguntaRelatorio(t, hojeNoBrasil());
    if (!interpretacao?.ehPerguntaDeGasto) return false;

    const periodo = resolverPeriodo(interpretacao.periodo, {
      dataInicio: interpretacao.dataInicioPersonalizada,
      dataFim: interpretacao.dataFimPersonalizada,
    });

    if (interpretacao.tipo === "geral" || !interpretacao.tipo) {
      await sendText(from, "⏳ Gerando o relatório, só um instante...");
      await gerarEEnviarRelatorioPorPergunta(from, periodo, "todos os lançamentos");
      return true;
    }

    if (interpretacao.ranking) {
      const resolvido = await resolverRanking(interpretacao.tipo, periodo);
      if (!resolvido) {
        await sendText(from, "📭 Não encontrei lançamentos para montar esse ranking nesse período.");
        return true;
      }
      await sendText(from, "⏳ Gerando o relatório, só um instante...");
      await gerarEEnviarRelatorioPorPergunta(
        from,
        { ...resolvido.filtro, ...periodo },
        resolvido.contexto,
        resolvido.ranking
      );
      return true;
    }

    if (!interpretacao.termoBusca) return false;

    const resolvido = await resolverDimensao(interpretacao.tipo, interpretacao.termoBusca);
    if (!resolvido) {
      await sendText(
        from,
        `🤔 Não encontrei "${interpretacao.termoBusca}" cadastrado. Confere o nome (ou digite *menu* pra ver as opções de relatório).`
      );
      return true;
    }
    if (resolvido.tipo === "ambiguo") {
      const lista = resolvido.opcoes.slice(0, 6).map((nome) => `• ${nome}`).join("\n");
      await sendText(
        from,
        `🤔 Achei mais de um para "${interpretacao.termoBusca}":\n${lista}\n\nPergunte de novo com o nome completo (ex: "quanto gastei com ${resolvido.opcoes[0]}?").`
      );
      return true;
    }

    await sendText(from, "⏳ Gerando o relatório, só um instante...");
    await gerarEEnviarRelatorioPorPergunta(from, { ...resolvido.filtro, ...periodo }, resolvido.contexto);
    return true;
  } catch (error) {
    console.error("Erro ao tentar relatório por pergunta:", error);
    return false;
  }
}
