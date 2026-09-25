import { MENU_IDS } from "@/lib/conversation/states";

export type Botao = {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
  /** So WhatsApp (lista): titulo curto (ate 24) e descricao (ate 72). O Telegram ignora. */
  curto?: string;
  dica?: string;
};
export type Teclado = Botao[][];
export type Entidade = { type: string; offset: number; length: number; [k: string]: unknown };

export const URL_DASHBOARD = "https://oryoncash.vercel.app/dashboard";

// ---------- Listas numeradas viram botoes ----------

export type ItemNumerado = { numero: number; rotulo: string };

const LINHA_NUMERADA = /^(\d+)\.\s+(.+)$/;
export const POR_PAGINA = 8;

/**
 * As listas de selecao do motor sao texto numerado terminado em "Responda
 * com o numero...". No Telegram cada linha vira um botao; tocar equivale a
 * digitar o numero (o motor ja trata). So considera mensagens com esse
 * rodape, pra nao transformar em botao qualquer texto que tenha "1. ...".
 */
export function extrairItensNumerados(texto: string): ItemNumerado[] {
  if (!/Responda com o n[uú]mero/i.test(texto)) return [];
  const itens: ItemNumerado[] = [];
  for (const linha of texto.split("\n")) {
    const m = linha.trim().match(LINHA_NUMERADA);
    if (m) itens.push({ numero: Number(m[1]), rotulo: m[2].trim() });
  }
  return itens.length >= 2 ? itens : [];
}

const MAX_BOTOES_WHATSAPP = 3;
const MAX_TITULO_BOTAO_WHATSAPP = 20;

/**
 * No WhatsApp, lista numerada CURTA (2 a 3 opcoes, cada uma cabendo no titulo
 * de 20 caracteres do botao) vira botoes de resposta; lista maior ou com nome
 * comprido continua texto numerado. O id do botao e n:<numero> - o parser
 * trata como se a pessoa tivesse digitado o numero, entao vale pra qualquer
 * lista do motor sem mexer nos fluxos.
 */
export function botoesDeListaNumerada(texto: string): { corpo: string; botoes: { id: string; title: string }[] } | null {
  const itens = extrairItensNumerados(texto);
  if (itens.length < 2 || itens.length > MAX_BOTOES_WHATSAPP) return null;
  if (itens.some((i) => [...i.rotulo].length > MAX_TITULO_BOTAO_WHATSAPP)) return null;

  const linhas = texto.split("\n");
  const primeira = linhas.findIndex((l) => LINHA_NUMERADA.test(l.trim()));
  const cabecalho = linhas.slice(0, Math.max(primeira, 0)).join("\n").trim();
  return {
    corpo: cabecalho || "Escolha uma opção:",
    botoes: itens.map((i) => ({ id: `n:${i.numero}`, title: i.rotulo })),
  };
}

export function tecladoDaPagina(itens: ItemNumerado[], pagina: number): Teclado {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const atual = Math.min(Math.max(pagina, 0), totalPaginas - 1);
  const teclado: Teclado = itens
    .slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA)
    .map((i) => [{ text: `${i.numero}. ${i.rotulo}`.slice(0, 60), callback_data: `n:${i.numero}` }]);

  if (totalPaginas > 1) {
    teclado.push([
      { text: atual > 0 ? "◀ Anterior" : "·", callback_data: atual > 0 ? `pg:${atual - 1}` : "pg:x" },
      { text: `${atual + 1}/${totalPaginas}`, callback_data: "pg:x" },
      {
        text: atual < totalPaginas - 1 ? "Próxima ▶" : "·",
        callback_data: atual < totalPaginas - 1 ? `pg:${atual + 1}` : "pg:x",
      },
    ]);
  }
  return teclado;
}

// ---------- Editar a mensagem depois do toque ----------

/**
 * Depois que a pessoa escolhe, a mensagem vira o registro da escolha (sem o
 * teclado). Em listas longas mantem so o titulo em vez das 27 linhas.
 */
export function mensagemComEscolha(
  texto: string,
  entidades: Entidade[] | undefined,
  rotuloEscolhido: string
): { texto: string; entidades: Entidade[] } {
  const linhas = texto.split("\n");
  const primeiraNumerada = linhas.findIndex((l) => LINHA_NUMERADA.test(l.trim()));
  const ehListaNumerada = extrairItensNumerados(texto).length > 0 && primeiraNumerada > 0;

  const base = ehListaNumerada ? linhas.slice(0, primeiraNumerada).join("\n").trimEnd() : texto;
  const novo = `${base}\n\n✅ ${rotuloEscolhido}`;
  const validas = (entidades ?? []).filter((e) => e.offset + e.length <= base.length);
  return { texto: novo, entidades: validas };
}

/** Rotulo do botao tocado, olhando o teclado que veio junto da mensagem. */
export function rotuloDoBotao(teclado: Teclado | undefined, callbackData: string): string | null {
  for (const linha of teclado ?? []) {
    for (const b of linha) if (b.callback_data === callbackData) return b.text;
  }
  return null;
}

// ---------- Botoes dos avisos automaticos ----------

export function botaoDashboard(caminho = "", rotulo = "🌐 Abrir dashboard"): Botao {
  return { text: rotulo, url: `${URL_DASHBOARD}${caminho}` };
}

/** Um botao "Paguei" por conta (ate 8) + atalho pro dashboard. */
export function tecladoContasAPagar(contas: { id: string; descricao: string }[]): Teclado {
  const linhas: Teclado = contas
    .slice(0, 8)
    .map((c) => [{ text: `✅ Paguei: ${c.descricao}`.slice(0, 60), callback_data: `cp:${c.id}`, curto: `✅ ${c.descricao}`.slice(0, 24), dica: `Marcar como paga: ${c.descricao}`.slice(0, 72) }]);
  linhas.push([botaoDashboard("/contas-a-pagar", "📅 Ver contas a pagar")]);
  return linhas;
}

/**
 * Botoes do aviso de lancamento novo: desfazer (so vale por alguns minutos),
 * corrigir e anexar comprovante de pagamento (quando ainda nao tem).
 */
export function tecladoLancamento(despesaId: string, opcoes: { comComprovante: boolean }): Teclado {
  const acoes: Botao[] = [{ text: "✏️ Corrigir", callback_data: `cr:${despesaId}` }];
  if (!opcoes.comComprovante) acoes.push({ text: "📎 Comprovante", callback_data: `ap:${despesaId}` });
  return [
    acoes,
    [{ text: "↩️ Desfazer", callback_data: `dz:${despesaId}` }, botaoDashboard("/despesas", "🧾 Ver lançamentos")],
  ];
}

export const TECLADO_RESUMO: Teclado = [
  [{ text: "📄 Gerar relatório", callback_data: MENU_IDS.RELATORIO }, botaoDashboard()],
];
