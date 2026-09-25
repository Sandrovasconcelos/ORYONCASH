import type { IncomingMessage } from "@/lib/whatsapp/parse";
import { destinoTelegram } from "./ids";

type TgFoto = { file_id: string; width: number; height: number; file_size?: number };
type TgMensagem = {
  message_id: number;
  from?: { id: number; is_bot?: boolean };
  chat: { id: number; type: string };
  text?: string;
  photo?: TgFoto[];
  document?: { file_id: string; mime_type?: string };
  voice?: { file_id: string; mime_type?: string };
  audio?: { file_id: string; mime_type?: string };
};
export type TgUpdate = {
  update_id: number;
  message?: TgMensagem;
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number; type: string } };
  };
};

export type ResultadoParse = {
  incoming: IncomingMessage | null;
  /** Presente quando o usuario tocou num botao - precisa ser "respondido" pro Telegram parar o relogio. */
  callback: { queryId: string; chatId: number; messageId: number } | null;
};

/** Comandos do Telegram (/start, /menu) viram a palavra "menu" que o motor ja entende. */
function normalizarTexto(texto: string): string {
  const t = texto.trim();
  if (!t.startsWith("/")) return t;
  const comando = t.split(/[\s@]/)[0].toLowerCase();
  if (comando === "/start" || comando === "/menu" || comando === "/cancelar") return "menu";
  return t;
}

export function parseTelegramUpdate(update: TgUpdate): ResultadoParse {
  const id = `tg_${update.update_id}`;

  const cb = update.callback_query;
  if (cb) {
    if (cb.message?.chat.type !== "private") return { incoming: null, callback: null };
    return {
      incoming: {
        id,
        from: destinoTelegram(cb.from.id),
        text: null,
        replyId: cb.data ?? null,
        media: null,
      },
      callback: { queryId: cb.id, chatId: cb.message.chat.id, messageId: cb.message.message_id },
    };
  }

  const msg = update.message;
  if (!msg || msg.chat.type !== "private" || !msg.from || msg.from.is_bot) {
    return { incoming: null, callback: null };
  }
  const from = destinoTelegram(msg.from.id);
  const base = { id, from, text: null, replyId: null, media: null };

  if (msg.text) return { incoming: { ...base, text: normalizarTexto(msg.text) }, callback: null };

  if (msg.photo && msg.photo.length > 0) {
    const maior = [...msg.photo].sort(
      (a, b) => (b.file_size ?? b.width * b.height) - (a.file_size ?? a.width * a.height)
    )[0];
    return {
      incoming: { ...base, media: { id: `tg_${maior.file_id}`, mimeType: "image/jpeg" } },
      callback: null,
    };
  }
  if (msg.document) {
    return {
      incoming: {
        ...base,
        media: {
          id: `tg_${msg.document.file_id}`,
          mimeType: msg.document.mime_type ?? "application/octet-stream",
        },
      },
      callback: null,
    };
  }
  const audio = msg.voice ?? msg.audio;
  if (audio) {
    return {
      incoming: {
        ...base,
        media: { id: `tg_${audio.file_id}`, mimeType: audio.mime_type ?? "audio/ogg" },
      },
      callback: null,
    };
  }

  return { incoming: base, callback: null };
}
