import { describe, expect, it } from "vitest";
import { avisosDoDia, mensagemDeAvisos } from "./avisos";

const base = {
  avisar_dias_antes: 30,
  aviso_antecipado_em: null,
  aviso_vencimento_em: null,
  area: "obra" as const,
  pasta: null,
  tipo: "Licenças",
  obras: { nome: "Aurora" },
};

describe("avisosDoDia", () => {
  const hoje = "2026-10-14";
  it("avisa antes, no dia e depois de vencer - uma vez cada", () => {
    const avisos = avisosDoDia(
      [
        { ...base, id: "a", nome: "Alvará", validade: "2026-10-30" },
        { ...base, id: "b", nome: "CND", validade: "2026-10-14" },
        { ...base, id: "c", nome: "FGTS", validade: "2026-10-01" },
        { ...base, id: "d", nome: "Longe", validade: "2027-03-01" },
        { ...base, id: "e", nome: "Ja avisado", validade: "2026-10-20", aviso_antecipado_em: "2026-10-01T10:00:00Z" },
        { ...base, id: "f", nome: "Vencido e avisado", validade: "2026-10-01", aviso_vencimento_em: "2026-10-02T10:00:00Z" },
      ],
      hoje
    );
    expect(avisos.map((a) => [a.id, a.marca])).toEqual([
      ["a", "antecipado"],
      ["b", "vencimento"],
      ["c", "vencimento"],
    ].sort((x, y) => avisos.findIndex((a) => a.id === x[0]) - avisos.findIndex((a) => a.id === y[0])));
    expect(avisos).toHaveLength(3);
  });
  it("monta a mensagem com os dois blocos", () => {
    const texto = mensagemDeAvisos(avisosDoDia([
      { ...base, id: "a", nome: "Alvará", validade: "2026-10-30" },
      { ...base, id: "c", nome: "FGTS", validade: "2026-10-01" },
    ], "2026-10-14"));
    expect(texto).toContain("Vencidos ou vencendo hoje");
    expect(texto).toContain("Vencendo em breve");
    expect(texto).toContain("Obras › Aurora › Licenças");
  });
});
