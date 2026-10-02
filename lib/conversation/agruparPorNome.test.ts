import { describe, expect, it } from "vitest";
import { agruparPorNome, candidatosPorPista } from "./agruparPorNome";

describe("agruparPorNome", () => {
  it("junta etapas de mesmo nome (ignorando acento, caixa e espaços duplos)", () => {
    const grupos = agruparPorNome([
      { id: "1", nome: "ALVENARIA E VEDAÇÃO" },
      { id: "2", nome: "Alvenaria e  Vedacao" },
      { id: "3", nome: "PINTURA" },
    ]);
    expect(grupos).toEqual([
      { nome: "ALVENARIA E VEDAÇÃO", ids: ["1", "2"] },
      { nome: "PINTURA", ids: ["3"] },
    ]);
  });

  it("lista vazia", () => {
    expect(agruparPorNome([])).toEqual([]);
  });
});

describe("candidatosPorPista", () => {
  const obras = [
    { id: "1", nome: "01 COSTA AMALFITANA" },
    { id: "2", nome: "02 Costa Amalfitana" },
    { id: "3", nome: "Oryon Constutora" },
  ];
  const materiais = [
    { id: "a", nome: "VERGALHAO CA50 10,0MM RETO NERV 12M N" },
    { id: "b", nome: "VERGALHAO CA60 5,00MM RETO 12M N" },
    { id: "c", nome: "cimento" },
    { id: "d", nome: "CIMENTO TDS OBRAS 50KG POTY" },
  ];

  it("devolve todos quando a pista é ambígua", () => {
    expect(candidatosPorPista(obras, "costa amalfitana").map((o) => o.id)).toEqual(["1", "2"]);
    expect(candidatosPorPista(materiais, "vergalhão").map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("nome exato vence os parecidos", () => {
    expect(candidatosPorPista(materiais, "cimento").map((m) => m.id)).toEqual(["c"]);
  });

  it("sem exato-primeiro, soma o exato e os parecidos", () => {
    expect(candidatosPorPista(materiais, "cimento", false).map((m) => m.id)).toEqual(["c", "d"]);
  });

  it("número no nome desambigua", () => {
    expect(candidatosPorPista(obras, "02 costa amalfitana").map((o) => o.id)).toEqual(["2"]);
  });

  it("sem correspondência ou pista vazia", () => {
    expect(candidatosPorPista(obras, "xyz")).toEqual([]);
    expect(candidatosPorPista(obras, "  ")).toEqual([]);
  });
});
