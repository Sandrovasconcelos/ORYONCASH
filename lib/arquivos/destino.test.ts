import { describe, expect, it } from "vitest";
import { aplicarDestino, destinoDoFormulario, mesmoLocal, nomeDaCopia } from "./destino";

const obras = new Set(["o1", "o2"]);
const aurora = { area: "obra" as const, obra_id: "o1", pasta: null, tipo: "Licenças" };

describe("aplicarDestino", () => {
  it("soltar num tipo muda so o tipo", () => {
    expect(aplicarDestino(aurora, { tipo: "Projetos" }, obras)).toEqual({ ...aurora, tipo: "Projetos" });
  });
  it("soltar numa obra muda a obra e mantem o tipo", () => {
    expect(aplicarDestino(aurora, { pastaChave: "o2" }, obras)).toEqual({ area: "obra", obra_id: "o2", pasta: null, tipo: "Licenças" });
  });
  it("soltar numa pasta de projeto (nome) usa pasta, sem obra", () => {
    expect(aplicarDestino(aurora, { pastaChave: "Villa Borghese" }, obras)).toEqual({ area: "obra", obra_id: null, pasta: "Villa Borghese", tipo: "Licenças" });
  });
  it("soltar em outra area sem dizer a pasta limpa a pasta", () => {
    expect(aplicarDestino(aurora, { area: "empresa" }, obras)).toEqual({ area: "empresa", obra_id: null, pasta: null, tipo: "Licenças" });
  });
  it("licitacao: a chave e o nome da licitacao", () => {
    expect(aplicarDestino(aurora, { area: "licitacao", pastaChave: "Concorrência 04/2026", tipo: "edital" }, obras)).toEqual({
      area: "licitacao",
      obra_id: null,
      pasta: "Concorrência 04/2026",
      tipo: "Edital",
    });
  });
  it("sem obra e geral viram sem pasta", () => {
    expect(aplicarDestino(aurora, { pastaChave: "_sem" }, obras)).toEqual({ area: "obra", obra_id: null, pasta: null, tipo: "Licenças" });
    expect(aplicarDestino({ area: "empresa", obra_id: null, pasta: "X", tipo: "Outros" }, { pastaChave: "_geral" }, obras).pasta).toBeNull();
  });
  it("area invalida e ignorada", () => {
    expect(aplicarDestino(aurora, { area: "xyz" }, obras)).toEqual(aurora);
  });
});

describe("mesmoLocal e nome da copia", () => {
  it("compara os 4 campos", () => {
    expect(mesmoLocal(aurora, { ...aurora })).toBe(true);
    expect(mesmoLocal(aurora, { ...aurora, tipo: "Projetos" })).toBe(false);
  });
  it("copia no mesmo lugar ganha (cópia) sem empilhar", () => {
    expect(nomeDaCopia("Alvará", false)).toBe("Alvará");
    expect(nomeDaCopia("Alvará", true)).toBe("Alvará (cópia)");
    expect(nomeDaCopia("Alvará (cópia)", true)).toBe("Alvará (cópia)");
  });
});

describe("destinoDoFormulario", () => {
  it("obra cadastrada", () => {
    expect(destinoDoFormulario({ area: "obra", obra_id: "o2", pasta: "", tipo: "Projetos" })).toEqual({ area: "obra", pastaChave: "o2", tipo: "Projetos" });
  });
  it("projeto digitado", () => {
    expect(destinoDoFormulario({ area: "obra", obra_id: "__projeto", pasta: " Villa Borghese ", tipo: "" })).toEqual({
      area: "obra",
      pastaChave: "Villa Borghese",
      tipo: undefined,
    });
  });
  it("licitacao e pessoal usam o texto da pasta", () => {
    expect(destinoDoFormulario({ area: "licitacao", obra_id: "", pasta: "Pregão 12", tipo: "Edital" })).toEqual({ area: "licitacao", pastaChave: "Pregão 12", tipo: "Edital" });
    expect(destinoDoFormulario({ area: "pessoal", obra_id: "", pasta: "", tipo: "" }).pastaChave).toBeNull();
  });
});

import { camposDeEnvioPara } from "./destino";

describe("camposDeEnvioPara", () => {
  const obrasIds = new Set(["o1"]);
  it("obra cadastrada", () => {
    expect(camposDeEnvioPara({ area: "obra", pastaChave: "o1", tipo: "Licenças" }, obrasIds)).toEqual({ area: "obra", obraId: "o1", pasta: "", tipo: "Licenças" });
  });
  it("projeto (nome) vira __projeto", () => {
    expect(camposDeEnvioPara({ area: "obra", pastaChave: "Villa Borghese" }, obrasIds)).toEqual({ area: "obra", obraId: "__projeto", pasta: "Villa Borghese", tipo: "Outros" });
  });
  it("area sem pasta e licitacao", () => {
    expect(camposDeEnvioPara({ area: "empresa", pastaChave: null }, obrasIds)).toEqual({ area: "empresa", obraId: "", pasta: "", tipo: "Outros" });
    expect(camposDeEnvioPara({ area: "licitacao", pastaChave: "Pregão 12" }, obrasIds).pasta).toBe("Pregão 12");
    expect(camposDeEnvioPara({ area: "obra", pastaChave: "_sem" }, obrasIds).obraId).toBe("");
  });
});
