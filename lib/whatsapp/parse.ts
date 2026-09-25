export type IncomingMedia = {
  id: string;
  mimeType: string;
};

export type IncomingMessage = {
  id: string | null;
  from: string;
  text: string | null;
  replyId: string | null;
  media: IncomingMedia | null;
};

type WebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          id?: string;
          from: string;
          type: string;
          text?: { body?: string };
          interactive?: {
            type: string;
            list_reply?: { id?: string };
            button_reply?: { id?: string };
          };
          image?: { id: string; mime_type: string };
          document?: { id: string; mime_type: string };
          audio?: { id: string; mime_type: string };
        }[];
      };
    }[];
  }[];
};

/**
 * Extrai a primeira mensagem de um payload de webhook do Meta Cloud API.
 * Retorna null para eventos que nao sao mensagens (ex.: status de entrega).
 */
export function parseIncomingMessage(payload: unknown): IncomingMessage | null {
  const entry = (payload as WebhookPayload)?.entry?.[0];
  const value = entry?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  const from: string = message.from;
  const id: string | null = message.id ?? null;

  if (message.type === "text") {
    return {
      id,
      from,
      text: message.text?.body?.trim() ?? null,
      replyId: null,
      media: null,
    };
  }

  if (message.type === "interactive") {
    const interactive = message.interactive;
    // Botao ou item de lista de uma lista numerada (n:<numero>) = a pessoa digitou o numero.
    const idDaResposta =
      interactive?.type === "list_reply"
        ? (interactive.list_reply?.id ?? null)
        : interactive?.type === "button_reply"
          ? (interactive.button_reply?.id ?? null)
          : null;
    if (idDaResposta !== null || interactive?.type === "list_reply" || interactive?.type === "button_reply") {
      if (idDaResposta?.startsWith("n:")) {
        return { id, from, text: idDaResposta.slice(2), replyId: null, media: null };
      }
      return { id, from, text: null, replyId: idDaResposta, media: null };
    }
  }

  if (message.type === "image" && message.image) {
    return {
      id,
      from,
      text: null,
      replyId: null,
      media: { id: message.image.id, mimeType: message.image.mime_type },
    };
  }

  if (message.type === "document" && message.document) {
    return {
      id,
      from,
      text: null,
      replyId: null,
      media: { id: message.document.id, mimeType: message.document.mime_type },
    };
  }

  if (message.type === "audio" && message.audio) {
    return {
      id,
      from,
      text: null,
      replyId: null,
      media: { id: message.audio.id, mimeType: message.audio.mime_type },
    };
  }

  return { id, from, text: null, replyId: null, media: null };
}
