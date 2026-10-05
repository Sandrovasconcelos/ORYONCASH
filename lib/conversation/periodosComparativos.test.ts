import { describe, expect, it } from "vitest";
import { periodosComparativos } from "./periodosComparativos";

describe("periodosComparativos", () => {
  it("mês: compara 1..hoje com 1..mesmo dia do mês passado", () => {
    const r = periodosComparativos("2026-10-15", "mes_atual");
    expect(r.atual).toEqual({ inicio: "2026-10-01", fim: "2026-10-15" });
    expect(r.anterior).toEqual({ inicio: "2026-09-01", fim: "2026-09-15" });
  });

  it("mês: dia 31 em mês anterior curto é limitado ao último dia", () => {
    const r = periodosComparativos("2026-10-31", "mes_atual");
    expect(r.anterior).toEqual({ inicio: "2026-09-01", fim: "2026-09-30" });
    const mar = periodosComparativos("2026-03-30", "mes_atual");
    expect(mar.anterior).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
  });

  it("mês: janeiro compara com dezembro do ano anterior", () => {
    const r = periodosComparativos("2026-01-10", "mes_atual");
    expect(r.anterior).toEqual({ inicio: "2025-12-01", fim: "2025-12-10" });
  });

  it("semana: segunda..hoje x semana anterior no mesmo trecho", () => {
    // quarta 2026-10-07
    const r = periodosComparativos("2026-10-07", "semana_atual");
    expect(r.atual).toEqual({ inicio: "2026-10-05", fim: "2026-10-07" });
    expect(r.anterior).toEqual({ inicio: "2026-09-28", fim: "2026-09-30" });
  });

  it("semana: domingo pertence à semana que começou na segunda anterior", () => {
    const r = periodosComparativos("2026-10-04", "semana_atual");
    expect(r.atual).toEqual({ inicio: "2026-09-28", fim: "2026-10-04" });
    expect(r.anterior).toEqual({ inicio: "2026-09-21", fim: "2026-09-27" });
  });

  it("ano: 1/jan até hoje x mesmo trecho do ano anterior", () => {
    const r = periodosComparativos("2026-10-05", "ano_atual");
    expect(r.atual).toEqual({ inicio: "2026-01-01", fim: "2026-10-05" });
    expect(r.anterior).toEqual({ inicio: "2025-01-01", fim: "2025-10-05" });
    expect(periodosComparativos("2028-02-29", "ano_atual").anterior.fim).toBe("2027-02-28");
  });
});
