export type IncomingMedia = {
  id: string;
  mimeType: string;
};

export type IncomingMessage = {
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

  if (message.type === "text") {
    return {
      from,
      text: message.text?.body?.trim() ?? null,
      replyId: null,
      media: null,
    };
  }

  if (message.type === "interactive") {
    const interactive = message.interactive;
    if (interactive?.type === "list_reply") {
      return {
        from,
        text: null,
        replyId: interactive.list_reply?.id ?? null,
        media: null,
      };
    }
    if (interactive?.type === "button_reply") {
      return {
        from,
        text: null,
        replyId: interactive.button_reply?.id ?? null,
        media: null,
      };
    }
  }

  if (message.type === "image" && message.image) {
    return {
      from,
      text: null,
      replyId: null,
      media: { id: message.image.id, mimeType: message.image.mime_type },
    };
  }

  if (message.type === "document" && message.document) {
    return {
      from,
      text: null,
      replyId: null,
      media: { id: message.document.id, mimeType: message.document.mime_type },
    };
  }

  return { from, text: null, replyId: null, media: null };
}
