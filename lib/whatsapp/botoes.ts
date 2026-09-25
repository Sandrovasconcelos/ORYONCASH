import type { Teclado } from "@/lib/telegram/interativo";
import { ehTelegram } from "@/lib/telegram/ids";
import { sendTelegramTextComBotoes } from "@/lib/telegram/messages";
import { sendButtons, sendList, sendText } from "./messages";

/**
 * O WhatsApp aceita ate 3 botoes de resposta (titulo de ate 20 caracteres) ou
 * uma lista de ate 10 itens (titulo de ate 24 + descricao de ate 72). Botoes
 * de link nao podem ser misturados com botoes de resposta, entao viram linhas
 * de texto com o endereco no fim da mensagem.
 */
const MAX_BOTOES = 3;
const MAX_ITENS_LISTA = 10;

export type EnvioWhatsApp =
  | { tipo: "texto"; corpo: string }
  | { tipo: "botoes"; corpo: string; botoes: { id: string; title: string }[] }
  | { tipo: "lista"; corpo: string; itens: { id: string; title: string; description?: string }[] };

export function montarEnvioWhatsApp(mensagem: string, teclado: Teclado | undefined): EnvioWhatsApp {
  const botoes = (teclado ?? []).flat();
  const links = botoes.filter((b) => b.url || b.web_app).map((b) => `${b.text}: ${b.url ?? b.web_app?.url}`);
  const corpo = links.length > 0 ? `${mensagem}\n\n${links.join("\n")}` : mensagem;

  const respostas = botoes.filter((b) => b.callback_data);
  if (respostas.length === 0) return { tipo: "texto", corpo };

  if (respostas.length <= MAX_BOTOES) {
    return {
      tipo: "botoes",
      corpo,
      botoes: respostas.map((b) => ({ id: b.callback_data!, title: b.text })),
    };
  }

  return {
    tipo: "lista",
    corpo,
    itens: respostas.slice(0, MAX_ITENS_LISTA).map((b) => ({
      id: b.callback_data!,
      title: b.curto ?? b.text,
      ...(b.dica ? { description: b.dica } : {}),
    })),
  };
}

/** Mensagem com botoes pro canal certo: Telegram (teclado inline) ou WhatsApp (botoes/lista nativos). */
export async function enviarComBotoes(to: string, mensagem: string, teclado: Teclado | undefined) {
  if (ehTelegram(to)) {
    return teclado ? sendTelegramTextComBotoes(to, mensagem, teclado) : sendText(to, mensagem);
  }

  const envio = montarEnvioWhatsApp(mensagem, teclado);
  if (envio.tipo === "texto") return sendText(to, envio.corpo);
  if (envio.tipo === "botoes") return sendButtons(to, envio.corpo, envio.botoes);
  return sendList(to, {
    bodyText: envio.corpo,
    buttonText: "Ver opções",
    sections: [{ rows: envio.itens }],
  });
}
