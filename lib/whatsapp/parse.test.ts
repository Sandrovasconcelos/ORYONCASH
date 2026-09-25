import { describe, expect, it } from "vitest";
import { parseIncomingMessage } from "./parse";

function payload(mensagem: Record<string, unknown>) {
  return {
    entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", from: "5598988219864", ...mensagem }] } }] }],
  };
}

describe("parseIncomingMessage - respostas interativas", () => {
  it("item de lista numerada (n:16) vira o numero digitado", () => {
    const m = parseIncomingMessage(
      payload({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "n:16", title: "Despesas Administrativas" } } })
    );
    expect(m).toMatchObject({ text: "16", replyId: null });
  });

  it("botao de lista numerada curta (n:2) vira o numero digitado", () => {
    const m = parseIncomingMessage(
      payload({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "n:2", title: "B" } } })
    );
    expect(m).toMatchObject({ text: "2", replyId: null });
  });

  it("outros ids seguem como replyId (menu, acoes dos avisos, Ver mais)", () => {
    const lista = parseIncomingMessage(
      payload({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "menu:relatorio" } } })
    );
    expect(lista).toMatchObject({ text: null, replyId: "menu:relatorio" });
    const botao = parseIncomingMessage(
      payload({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "dz:abc" } } })
    );
    expect(botao).toMatchObject({ text: null, replyId: "dz:abc" });
    const pag = parseIncomingMessage(
      payload({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "pg:tk:1" } } })
    );
    expect(pag).toMatchObject({ replyId: "pg:tk:1" });
  });
});
