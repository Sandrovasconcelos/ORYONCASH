import { describe, expect, it } from "vitest";
import { descreverVariacao, percentualDoOrcamento } from "./consultasTexto";

describe("percentualDoOrcamento", () => {
  it("calcula o percentual arredondado", () => {
    expect(percentualDoOrcamento(460149.05, 1000000)).toBe(46);
    expect(percentualDoOrcamento(1200, 1000)).toBe(120);
  });
  it("sem orçamento devolve 0", () => {
    expect(percentualDoOrcamento(100, 0)).toBe(0);
  });
});

describe("descreverVariacao", () => {
  it("mais", () => {
    expect(descreverVariacao(1500, 1000)).toContain("a mais");
    expect(descreverVariacao(1500, 1000)).toContain("+50%");
  });
  it("menos", () => {
    expect(descreverVariacao(500, 1000)).toContain("a menos");
    expect(descreverVariacao(500, 1000)).toContain("-50%");
  });
  it("igual e anterior zerado", () => {
    expect(descreverVariacao(1000, 1000)).toContain("igual");
    expect(descreverVariacao(300, 0)).toContain("não houve gasto");
  });
});
