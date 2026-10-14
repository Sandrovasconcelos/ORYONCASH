import { describe, expect, it } from "vitest";
import { areaDaLegenda, obraDaLegenda, tipoDaLegenda } from "./legenda";

const obras = [
  { id: "o1", nome: "01 COSTA AMALFITANA" },
  { id: "o2", nome: "02 Costa Amalfitana" },
  { id: "o3", nome: "Oryon Constutora" },
];

describe("obraDaLegenda", () => {
  it("o numero da legenda desempata obras de mesmo nome (o caso da fase 02)", () => {
    const r = obraDaLegenda("Em obra costa amalfitana fase 02: guia de tributos alvará de obra e multas valor", obras);
    expect(r).toEqual({ tipo: "obra", obra: obras[1] });
    expect(obraDaLegenda("costa amalfitana fase 1, projeto", obras)).toEqual({ tipo: "obra", obra: obras[0] });
  });
  it("sem numero, pergunta em vez de adivinhar", () => {
    const r = obraDaLegenda("guia da obra costa amalfitana", obras);
    expect(r?.tipo).toBe("ambiguo");
    expect(r && r.tipo === "ambiguo" ? r.opcoes.map((o) => o.id) : []).toEqual(["o1", "o2"]);
  });
  it("numero que nao e de nenhuma obra (ex: ano) continua ambiguo", () => {
    expect(obraDaLegenda("alvará 2026 costa amalfitana", obras)?.tipo).toBe("ambiguo");
  });
  it("obra de nome unico", () => {
    expect(obraDaLegenda("contrato da oryon constutora", obras)).toEqual({ tipo: "obra", obra: obras[2] });
  });
  it("nao cita obra cadastrada", () => {
    expect(obraDaLegenda("matrícula da villa borghese", obras)).toBeNull();
    expect(obraDaLegenda("", obras)).toBeNull();
  });
});

describe("tipoDaLegenda", () => {
  it("o mesmo texto cai sempre no mesmo tipo", () => {
    const legenda = "Em obra costa amalfitana fase 02: guia de tributos alvará de obra e multas valor";
    expect(tipoDaLegenda(legenda)).toBe("Guias e taxas");
    expect(tipoDaLegenda(legenda)).toBe(tipoDaLegenda(legenda));
  });
  it("outros tipos", () => {
    expect(tipoDaLegenda("alvará de construção do Aurora")).toBe("Licenças");
    expect(tipoDaLegenda("matrícula do lote 12")).toBe("Terreno e matrícula");
    expect(tipoDaLegenda("planta baixa rev 3")).toBe("Projetos");
    expect(tipoDaLegenda("orçamento de tintas")).toBe("Orçamentos");
    expect(tipoDaLegenda("certidão negativa federal")).toBe("Certidões");
    expect(tipoDaLegenda("bom dia")).toBeNull();
  });
});

describe("areaDaLegenda", () => {
  it("so quando a legenda diz", () => {
    expect(areaDaLegenda("Arquivar em Pessoal: orçamento")).toBe("pessoal");
    expect(areaDaLegenda("edital da concorrência 04/2026")).toBe("licitacao");
    expect(areaDaLegenda("certidão da empresa")).toBe("empresa");
    expect(areaDaLegenda("alvará do Aurora")).toBeNull();
  });
});
