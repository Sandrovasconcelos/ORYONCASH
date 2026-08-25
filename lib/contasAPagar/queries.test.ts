import { describe, it, expect } from "vitest";
import { proximaData } from "./queries";

describe("proximaData", () => {
  it("retorna null quando nao e recorrente", () => {
    expect(proximaData("2026-08-25", "nenhuma")).toBeNull();
  });

  it("soma 7 dias corridos pra recorrencia semanal", () => {
    expect(proximaData("2026-08-25", "semanal")).toBe("2026-09-01");
  });

  it("mantem o mesmo dia no mes seguinte pra recorrencia mensal", () => {
    expect(proximaData("2026-08-05", "mensal")).toBe("2026-09-05");
  });

  it("mensal atravessando o fim do ano", () => {
    expect(proximaData("2026-12-20", "mensal")).toBe("2027-01-20");
  });

  it("mensal em dia 31 rola pro mes seguinte quando ele e mais curto", () => {
    expect(proximaData("2026-01-31", "mensal")).toBe("2026-03-03");
  });
});
