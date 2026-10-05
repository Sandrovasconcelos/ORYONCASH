import { describe, expect, it } from "vitest";
import { extrairEventosMeta, mensagemDeAviso } from "./eventosMeta";

const envelope = (field: string, value: unknown) => ({
  entry: [{ id: "WABA", time: 1, changes: [{ field, value }] }],
});

describe("extrairEventosMeta", () => {
  it("account_update com banimento: importante e com os detalhes", () => {
    const [e] = extrairEventosMeta(
      envelope("account_update", {
        phone_number: "559882501688",
        event: "DISABLED_UPDATE",
        ban_info: { waba_ban_state: "DISABLE", waba_ban_date: "2026-10-02" },
      })
    );
    expect(e.campo).toBe("account_update");
    expect(e.evento).toBe("DISABLED_UPDATE");
    expect(e.importante).toBe(true);
    expect(e.resumo).toContain("waba_ban_state");
    expect(e.resumo).toContain("2026-10-02");
  });

  it("account_review_update e nome de exibição recusado trazem a decisão e o motivo", () => {
    const [rev] = extrairEventosMeta(envelope("account_review_update", { decision: "REJECTED" }));
    expect(rev.evento).toBe("REJECTED");
    expect(rev.importante).toBe(true);

    const [nome] = extrairEventosMeta(
      envelope("phone_number_name_update", {
        display_phone_number: "559882501688",
        decision: "DECLINED",
        requested_verified_name: "OryonCash",
        rejection_reason: "NAME_NOT_CONSISTENT_WITH_BUSINESS",
      })
    );
    expect(nome.resumo).toContain("NAME_NOT_CONSISTENT_WITH_BUSINESS");
  });

  it("account_alerts traz tipo e descrição do alerta", () => {
    const [a] = extrairEventosMeta(
      envelope("account_alerts", {
        alert_type: "OBA_APPROVED",
        alert_severity: "INFORMATIONAL",
        alert_description: "texto do alerta",
      })
    );
    expect(a.resumo).toContain("texto do alerta");
    expect(a.importante).toBe(true);
  });

  it("falha de envio grave (spam rate limit) é importante; falha comum só é registrada", () => {
    const grave = extrairEventosMeta(
      envelope("messages", {
        statuses: [{ id: "w", status: "failed", errors: [{ code: 131048, title: "Spam rate limit hit", message: "x" }] }],
      })
    );
    expect(grave[0].importante).toBe(true);
    expect(grave[0].evento).toBe("falha_envio_131048");

    const comum = extrairEventosMeta(
      envelope("messages", {
        statuses: [{ id: "w", status: "failed", errors: [{ code: 131047, title: "Re-engagement message" }] }],
      })
    );
    expect(comum[0].importante).toBe(false);
  });

  it("mensagens e status normais não geram evento", () => {
    expect(
      extrairEventosMeta(envelope("messages", { messages: [{ id: "a", text: { body: "oi" } }] }))
    ).toEqual([]);
    expect(
      extrairEventosMeta(envelope("messages", { statuses: [{ id: "w", status: "delivered" }] }))
    ).toEqual([]);
  });

  it("payload estranho não quebra", () => {
    expect(extrairEventosMeta(null)).toEqual([]);
    expect(extrairEventosMeta({})).toEqual([]);
    expect(extrairEventosMeta({ entry: "x" })).toEqual([]);
  });

  it("mensagemDeAviso lista todos os eventos", () => {
    const eventos = extrairEventosMeta(envelope("account_review_update", { decision: "APPROVED" }));
    expect(mensagemDeAviso(eventos)).toContain("APPROVED");
  });
});
