import { sendWhatsAppMessage } from "./graph";

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type ListRow = { id: string; title: string; description?: string };
export type ListSection = { title?: string; rows: ListRow[] };

export async function sendText(to: string, body: string) {
  return sendWhatsAppMessage({
    to,
    type: "text",
    text: { body },
  });
}

export async function sendList(
  to: string,
  opts: {
    headerText?: string;
    bodyText: string;
    buttonText: string;
    sections: ListSection[];
  }
) {
  return sendWhatsAppMessage({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: opts.headerText
        ? { type: "text", text: truncate(opts.headerText, 60) }
        : undefined,
      body: { text: truncate(opts.bodyText, 1024) },
      action: {
        button: truncate(opts.buttonText, 20),
        sections: opts.sections.map((section) => ({
          title: section.title ? truncate(section.title, 24) : undefined,
          rows: section.rows.map((row) => ({
            id: row.id,
            title: truncate(row.title, 24),
            description: row.description
              ? truncate(row.description, 72)
              : undefined,
          })),
        })),
      },
    },
  });
}

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  return sendWhatsAppMessage({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: truncate(bodyText, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((button) => ({
          type: "reply",
          reply: { id: button.id, title: truncate(button.title, 20) },
        })),
      },
    },
  });
}
