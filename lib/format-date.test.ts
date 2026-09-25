import { describe, expect, it } from "vitest";
import { formatDataBrasil } from "./format-date";

describe("formatDataBrasil", () => {
  it("data sem hora nao volta um dia por causa do fuso", () => {
    expect(formatDataBrasil("2026-08-21")).toBe("21/08/2026");
    expect(formatDataBrasil("2026-08-01")).toBe("01/08/2026");
  });

  it("timestamp completo continua convertido pro horario do Brasil", () => {
    // 01:00 UTC do dia 22 = 22h do dia 21 em Fortaleza (UTC-3)
    expect(formatDataBrasil("2026-08-22T01:00:00Z")).toBe("21/08/2026");
  });
});
