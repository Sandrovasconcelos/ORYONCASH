import type { Json } from "@/lib/database.types";
import type { ItemNumerado } from "@/lib/telegram/interativo";
import { sendWhatsAppMessage } from "./graph";
import { getSession, saveSession } from "./session";

/**
 * Lista numerada do motor ("1. Obra A ... Responda com o numero") no WhatsApp:
 * lista nativa com botao "Ver opcoes", com ate 8 itens por pagina e linhas
 * "Anterior"/"Ver mais" - o equivalente das setas de pagina do Telegram.
 * Tocar num item envia n:<numero>, que o parser trata como a pessoa ter
 * digitado o numero (vale pra qualquer lista sem mexer nos fluxos).
 *
 * A API do WhatsApp nao devolve o texto original da mensagem, entao a lista
 * completa fica guardada na sessao (_lista) pra montar as outras paginas.
 */

export const POR_PAGINA_WHATSAPP = 8;
const CHAVE_LISTA = "_lista";

type ListaGuardada = { token: string; corpo: string; itens: ItemNumerado[] };

function truncar(texto: string, max: number) {
  const letras = [...texto];
  return letras.length > max ? `${letras.slice(0, max - 1).join("")}…` : texto;
}

/**
 * Separa o enunciado (antes da 1a linha numerada) do resto. O rodape padrao
 * "Responda com o numero..." some (os botoes ja sao a resposta); qualquer
 * outra observacao depois da lista (ex: "ou digite outro numero de dias") fica.
 */
export function corpoDaLista(texto: string): string {
  const linhas = texto.split("\n");
  const ehItem = (l: string) => /^\d+\.\s+\S/.test(l.trim());
  const primeira = linhas.findIndex(ehItem);
  const ultima = linhas.length - 1 - [...linhas].reverse().findIndex(ehItem);

  const antes = linhas.slice(0, Math.max(primeira, 0)).join("\n").trim();
  const depois = linhas.slice(ultima + 1).join("\n").trim();
  const rodapePadrao = /^Responda com o n[uú]mero( ou digite o nome)?\.?$/i;
  const extra = depois && !rodapePadrao.test(depois) ? depois : "";
  return [antes || "Escolha uma opção:", extra].filter(Boolean).join("\n\n");
}

export function totalDePaginas(qtdItens: number): number {
  return Math.max(1, Math.ceil(qtdItens / POR_PAGINA_WHATSAPP));
}

/** Linhas de uma pagina da lista (itens + Anterior/Ver mais), ate 10 no total. */
export function linhasDaPagina(token: string, itens: ItemNumerado[], pagina: number) {
  const total = totalDePaginas(itens.length);
  const atual = Math.min(Math.max(pagina, 0), total - 1);
  const inicio = atual * POR_PAGINA_WHATSAPP;
  const doPeriodo = itens.slice(inicio, inicio + POR_PAGINA_WHATSAPP);

  const linhas: { id: string; title: string; description?: string }[] = doPeriodo.map((i) => ({
    id: `n:${i.numero}`,
    title: truncar(i.rotulo, 24),
    ...([...i.rotulo].length > 24 ? { description: truncar(i.rotulo, 72) } : {}),
  }));

  if (atual > 0) {
    linhas.push({ id: `pg:${token}:${atual - 1}`, title: "⬅️ Anterior", description: `Página ${atual} de ${total}` });
  }
  if (atual < total - 1) {
    const de = inicio + POR_PAGINA_WHATSAPP + 1;
    const ate = Math.min(inicio + 2 * POR_PAGINA_WHATSAPP, itens.length);
    linhas.push({ id: `pg:${token}:${atual + 1}`, title: "➡️ Ver mais", description: `Opções ${de} a ${ate} de ${itens.length}` });
  }
  return { linhas, atual, total };
}

async function enviarPagina(to: string, lista: ListaGuardada, pagina: number) {
  const { linhas, atual, total } = linhasDaPagina(lista.token, lista.itens, pagina);
  const rodape = total > 1 ? `\n\n📄 Página ${atual + 1} de ${total} · ${lista.itens.length} opções` : "";
  return sendWhatsAppMessage({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: truncar(lista.corpo + rodape, 1024) },
      action: { button: "Ver opções", sections: [{ rows: linhas }] },
    },
  });
}

/** Manda a lista numerada como lista nativa (pagina 1) e guarda os itens pra paginar. */
export async function enviarListaNumerada(to: string, texto: string, itens: ItemNumerado[]) {
  const lista: ListaGuardada = { token: Date.now().toString(36), corpo: corpoDaLista(texto), itens };

  // Guarda sem mexer no estado nem nos dados do fluxo em andamento.
  if (itens.length > POR_PAGINA_WHATSAPP) {
    const sessao = await getSession(to);
    await saveSession(to, sessao.estado_atual, { ...sessao.dados_coletados, [CHAVE_LISTA]: lista as unknown as Json });
  }
  return enviarPagina(to, lista, 0);
}

/** "Ver mais" / "Anterior": outra pagina da lista guardada. */
export async function mostrarPaginaDaLista(to: string, token: string, pagina: number): Promise<boolean> {
  const sessao = await getSession(to);
  const lista = sessao.dados_coletados[CHAVE_LISTA] as unknown as ListaGuardada | undefined;
  if (!lista || lista.token !== token) return false;
  await enviarPagina(to, lista, pagina);
  return true;
}

export const CHAVE_LISTA_NA_SESSAO = CHAVE_LISTA;
