import { telegramCall, telegramUpload } from "./api";
import { chatIdDe } from "./ids";
import type { ListSection } from "@/lib/whatsapp/messages";
import { URL_DASHBOARD, extrairItensNumerados, tecladoDaPagina, type Botao, type Teclado } from "./interativo";

const LIMITE_MENSAGEM = 4000; // teto do Telegram e 4096
const LIMITE_CALLBACK_BYTES = 64;

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Os textos do bot sao escritos com a marcacao do WhatsApp (*negrito*,
 * _italico_). Converte pra HTML do Telegram; se o resultado sair mal
 * formado o Telegram recusa (400) e quem chama reenvia como texto puro.
 */
export function whatsappParaHtml(texto: string): string {
  return escaparHtml(texto)
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, "$1<i>$2</i>");
}

function dividirEmPartes(texto: string): string[] {
  if (texto.length <= LIMITE_MENSAGEM) return [texto];
  const partes: string[] = [];
  let atual = "";
  for (const linha of texto.split("\n")) {
    if (atual.length + linha.length + 1 > LIMITE_MENSAGEM && atual) {
      partes.push(atual);
      atual = "";
    }
    atual += (atual ? "\n" : "") + linha.slice(0, LIMITE_MENSAGEM);
  }
  if (atual) partes.push(atual);
  return partes;
}

async function enviarMensagem(chatId: string, texto: string, teclado?: Teclado) {
  const partes = dividirEmPartes(texto);
  for (let i = 0; i < partes.length; i++) {
    const replyMarkup =
      teclado && i === partes.length - 1 ? { inline_keyboard: teclado } : undefined;
    try {
      await telegramCall("sendMessage", {
        chat_id: chatId,
        text: whatsappParaHtml(partes[i]),
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    } catch (error) {
      // HTML mal formado (ex: * solto) - reenvia sem formatacao.
      if (!(error instanceof Error) || !error.message.includes("(400)")) throw error;
      await telegramCall("sendMessage", {
        chat_id: chatId,
        text: partes[i],
        reply_markup: replyMarkup,
      });
    }
  }
}

function botao(id: string, rotulo: string) {
  if (Buffer.byteLength(id, "utf8") > LIMITE_CALLBACK_BYTES) {
    console.error(`Telegram: id de botao acima de ${LIMITE_CALLBACK_BYTES} bytes, ignorado:`, id);
    return null;
  }
  return { text: rotulo.slice(0, 60), callback_data: id };
}

export async function sendTelegramText(to: string, body: string) {
  // Lista numerada do motor ("... Responda com o numero") vira botoes
  // paginados; tocar num botao equivale a digitar o numero.
  const itens = extrairItensNumerados(body);
  await enviarMensagem(chatIdDe(to), body, itens.length > 0 ? tecladoDaPagina(itens, 0) : undefined);
}

export async function sendTelegramList(
  to: string,
  opts: { headerText?: string; bodyText: string; sections: ListSection[] }
) {
  const texto = opts.headerText ? `*${opts.headerText}*
${opts.bodyText}` : opts.bodyText;
  const linhas = opts.sections.flatMap((secao) => secao.rows);

  // Menu principal: so o titulo (a descricao cortava o texto do botao), em 2
  // colunas, com o dashboard na ultima linha.
  if (opts.headerText?.includes("Menu Principal")) {
    const botoes = linhas
      .map((l) => botao(l.id, l.title))
      .filter((b): b is { text: string; callback_data: string } => b !== null);
    const teclado: Teclado = [];
    for (let i = 0; i < botoes.length; i += 2) teclado.push(botoes.slice(i, i + 2));
    const dashboard: Botao = { text: "🌐 Abrir dashboard", web_app: { url: URL_DASHBOARD } };
    teclado.push([dashboard]);
    await enviarMensagem(chatIdDe(to), texto, teclado);
    return;
  }

  const teclado: Teclado = [];
  for (const linha of linhas) {
    const rotulo = linha.description ? `${linha.title} — ${linha.description}` : linha.title;
    const b = botao(linha.id, rotulo);
    if (b) teclado.push([b]);
  }
  await enviarMensagem(chatIdDe(to), texto, teclado.slice(0, 100));
}

export async function sendTelegramButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  const linha = buttons
    .map((b) => botao(b.id, b.title))
    .filter((b): b is { text: string; callback_data: string } => b !== null);
  await enviarMensagem(chatIdDe(to), bodyText, linha.length > 0 ? [linha] : undefined);
}

export async function sendTelegramDocument(
  to: string,
  link: string,
  filename: string,
  caption?: string
) {
  const res = await fetch(link);
  if (!res.ok) throw new Error(`Falha ao buscar o documento pra enviar (${res.status})`);
  const arquivo = await res.blob();
  await telegramUpload(
    "sendDocument",
    { chat_id: chatIdDe(to), ...(caption ? { caption: caption.slice(0, 1000) } : {}) },
    { nome: "document", arquivo, filename }
  );
}

/** Aviso com botoes (URL e/ou toque) - usado nas notificacoes automaticas. */
export async function sendTelegramTextComBotoes(to: string, body: string, teclado: Teclado) {
  await enviarMensagem(chatIdDe(to), body, teclado);
}
