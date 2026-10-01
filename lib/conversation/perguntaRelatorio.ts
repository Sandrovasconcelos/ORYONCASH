import type { FiltrosRelatorio } from "@/lib/relatorio/dados";
import { interpretarPerguntaRelatorio, type TipoFiltroRelatorio } from "@/lib/gemini/interpretarPerguntaRelatorio";
import { sendText } from "@/lib/whatsapp/messages";
import { gerarEEnviarRelatorioPorPergunta } from "./relatorio";
import {
  encontrarPorPista,
  hojeNoBrasil,
  listCategorias,
  listEtapas,
  listFornecedores,
  listMateriais,
  listObrasAtivas,
} from "./queries";

// Ve se vale a pena chamar o Gemini (que custa tempo/dinheiro) antes de
// qualquer coisa - so passa quem tem cara de pergunta de gasto. O Gemini
// ainda confirma de verdade (ehPerguntaDeGasto) pra nao disparar em falso.
const PARECE_PERGUNTA_DE_GASTO =
  /quanto.{0,20}gast|gast\w*.{0,20}quanto|^gastos? (com|em|de|no|na)|total (de )?gastos? (com|em|de|no|na)/;

async function tentarDimensao(
  tipo: TipoFiltroRelatorio,
  termo: string
): Promise<{ filtro: Partial<FiltrosRelatorio>; contexto: string } | null> {
  switch (tipo) {
    case "categoria": {
      const match = encontrarPorPista(await listCategorias(), termo);
      return match ? { filtro: { categoria: match.id }, contexto: match.nome } : null;
    }
    case "material": {
      const match = encontrarPorPista(await listMateriais(), termo);
      return match ? { filtro: { material: match.id }, contexto: match.nome } : null;
    }
    case "fornecedor": {
      const match = encontrarPorPista(await listFornecedores(), termo);
      return match ? { filtro: { fornecedor: match.id }, contexto: match.nome } : null;
    }
    case "etapa": {
      const match = encontrarPorPista(await listEtapas(), termo);
      return match ? { filtro: { etapa: match.id }, contexto: match.nome } : null;
    }
    case "obra": {
      const match = encontrarPorPista(await listObrasAtivas(), termo);
      return match ? { filtro: { obra: match.id }, contexto: match.nome } : null;
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
 * listas, entao vale tentar antes de desistir.
 */
async function resolverDimensao(
  tipoSugerido: TipoFiltroRelatorio,
  termo: string
): Promise<{ filtro: Partial<FiltrosRelatorio>; contexto: string } | null> {
  const ordem = [tipoSugerido, ...TODAS_DIMENSOES.filter((tipo) => tipo !== tipoSugerido)];
  for (const tipo of ordem) {
    const resolvido = await tentarDimensao(tipo, termo);
    if (resolvido) return resolvido;
  }
  return null;
}

/**
 * Tenta tratar uma mensagem livre como pergunta de gasto ("quanto gastei
 * com cimento?", "quanto já gastei com a mão de obra do Alex?") e, se for,
 * manda o relatório em PDF já filtrado. So chamada quando o usuario esta no
 * menu (texto livre sem fluxo em andamento) - ver handleMenu em engine.ts.
 */
export async function tentarRelatorioPorPergunta(from: string, texto: string | null): Promise<boolean> {
  const t = texto?.trim();
  if (!t || t.length < 6 || !PARECE_PERGUNTA_DE_GASTO.test(t.toLowerCase())) return false;

  try {
    const interpretacao = await interpretarPerguntaRelatorio(t, hojeNoBrasil());
    if (!interpretacao?.ehPerguntaDeGasto) return false;

    const periodo = { dataInicio: interpretacao.dataInicio ?? undefined, dataFim: interpretacao.dataFim ?? undefined };

    if (interpretacao.tipo === "geral" || !interpretacao.tipo) {
      await sendText(from, "⏳ Gerando o relatório, só um instante...");
      await gerarEEnviarRelatorioPorPergunta(from, periodo, "todos os lançamentos");
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

    await sendText(from, "⏳ Gerando o relatório, só um instante...");
    await gerarEEnviarRelatorioPorPergunta(from, { ...resolvido.filtro, ...periodo }, resolvido.contexto);
    return true;
  } catch (error) {
    console.error("Erro ao tentar relatório por pergunta:", error);
    return false;
  }
}
