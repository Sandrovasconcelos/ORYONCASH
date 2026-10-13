import { describe, expect, it } from "vitest";
import {
  dataLocalDe,
  diaDaSemana,
  formatarInstante,
  limitesDaSemana,
  limitesDoDia,
  paraInstante,
  proximosDias,
  somarDias,
} from "./datas";

describe("paraInstante / formatarInstante", () => {
  it("15:00 de Brasília = 18:00 UTC, e volta formatado igual", () => {
    const i = paraInstante("2026-10-15", "15:00")!;
    expect(i.toISOString()).toBe("2026-10-15T18:00:00.000Z");
    expect(formatarInstante(i)).toBe("qui 15/10 às 15:00");
  });

  it("noite vira o dia seguinte em UTC, mas a data local continua certa", () => {
    const i = paraInstante("2026-10-15", "22:30")!;
    expect(i.toISOString()).toBe("2026-10-16T01:30:00.000Z");
    expect(dataLocalDe(i)).toBe("2026-10-15");
    expect(formatarInstante(i)).toBe("qui 15/10 às 22:30");
  });

  it("rejeita data ou hora inválida", () => {
    expect(paraInstante("2026-02-30", "10:00")).toBeNull();
    expect(paraInstante("2026-10-15", "25:00")).toBeNull();
    expect(paraInstante("15/10/2026", "10:00")).toBeNull();
    expect(paraInstante("2026-10-15", "9h")).toBeNull();
  });
});

describe("dias e semanas", () => {
  it("dia da semana e soma de dias", () => {
    expect(diaDaSemana("2026-10-15")).toBe("qui");
    expect(somarDias("2026-10-30", 3)).toBe("2026-11-02");
    expect(somarDias("2026-01-02", -3)).toBe("2025-12-30");
  });

  it("limites do dia em instantes reais", () => {
    const { inicio, fim } = limitesDoDia("2026-10-15");
    expect(inicio.toISOString()).toBe("2026-10-15T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-10-16T03:00:00.000Z");
  });

  it("semana vai de segunda a domingo (quarta 14/10 -> 12/10 a 18/10)", () => {
    const { inicio, fim } = limitesDaSemana("2026-10-14");
    expect(dataLocalDe(inicio)).toBe("2026-10-12");
    expect(dataLocalDe(new Date(fim.getTime() - 1))).toBe("2026-10-18");
    // domingo ainda é da mesma semana
    expect(dataLocalDe(limitesDaSemana("2026-10-18").inicio)).toBe("2026-10-12");
  });

  it("próximos dias traz o dia da semana de cada um", () => {
    expect(proximosDias("2026-10-14", 3)).toEqual([
      { data: "2026-10-14", diaSemana: "qua" },
      { data: "2026-10-15", diaSemana: "qui" },
      { data: "2026-10-16", diaSemana: "sex" },
    ]);
  });
});
