import { MENU_IDS } from "@/lib/conversation/states";

export type Botao = { text: string; callback_data?: string; url?: string };
export type Teclado = Botao[][];
export type Entidade = { type: string; offset: number; length: number; [k: string]: unknown };

// ---------- Teclado fixo (aparece embaixo do chat) ----------

export const URL_DASHBOARD = "https://oryoncash.vercel.app/dashboard";

const ATALHOS: { rotulo: string; replyId?: string; texto?: string }[] = [
  { rotulo: "💸 Registrar despesa", replyId: MENU_IDS.REGISTRAR_DESPESA },
  { rotulo: "📅 Conta a pagar", replyId: MENU_IDS.CONTA_A_PAGAR },
  { rotulo: "📊 Ver resumo", replyId: MENU_IDS.VER_RESUMO },
  { rotulo: "📄 Relatório", replyId: MENU_IDS.RELATORIO },
  { rotulo: "✏️ Corrigir", replyId: MENU_IDS.CORRIGIR_LANCAMENTO },
  { rotulo: "🏠 Menu", texto: "menu" },
];

export const TECLADO_FIXO = {
  keyboard: [
    [{ text: ATALHOS[0].rotulo }, { text: ATALHOS[1].rotulo }],
    [{ text: ATALHOS[2].rotulo }, { text: ATALHOS[3].rotulo }],
    [{ text: ATALHOS[4].rotulo }, { text: ATALHOS[5].rotulo }],
    [{ text: "🌐 Abrir dashboard", web_app: { url: URL_DASHBOARD } }],
  ],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: "Toque num atalho ou digite",
};

/** Texto de um atalho do teclado fixo -> o que o motor entende. */
export function atalhoDoTeclado(texto: string): { replyId: string | null; texto: string | null } | null {
  const a = ATALHOS.find((x) => x.rotulo === texto.trim());
  return a ? { replyId: a.replyId ?? null, texto: a.texto ?? null } : null;
}

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
