import { describe, it, expect } from "vitest";
import {
  calcularItensElegiveisParaMedicao,
  calcularCurvaS,
  type EtapaParaMedicao,
} from "./queries";

function etapa(overrides: Partial<EtapaParaMedicao> = {}): EtapaParaMedicao {
  return {
    id: "etapa-1",
    nome: "Fundação",
    valorOrcado: 10000,
    percentualExecutado: 50,
    situacaoQualidade: "aprovado",
    fornecedorId: "fornecedor-1",
    ...overrides,
  };
}

describe("calcularItensElegiveisParaMedicao", () => {
  it("ignora etapa sem qualidade aprovada", () => {
    const itens = calcularItensElegiveisParaMedicao(
      [etapa({ situacaoQualidade: "pendente" })],
      new Map()
    );
    expect(itens).toHaveLength(0);
  });

  it("ignora etapa sem fornecedor vinculado", () => {
    const itens = calcularItensElegiveisParaMedicao(
      [etapa({ fornecedorId: null })],
      new Map()
    );
    expect(itens).toHaveLength(0);
  });

  it("calcula o delta desde a ultima medicao, nao o acumulado", () => {
    const itens = calcularItensElegiveisParaMedicao(
      [etapa({ percentualExecutado: 60 })],
      new Map([["etapa-1", 40]])
    );
    expect(itens).toHaveLength(1);
    expect(itens[0].percentualMedido).toBe(20);
    expect(itens[0].valorMedido).toBe(2000);
  });

  it("nao permite medir o que ja foi medido (delta <= 0)", () => {
    const itens = calcularItensElegiveisParaMedicao(
      [etapa({ percentualExecutado: 50 })],
      new Map([["etapa-1", 50]])
    );
    expect(itens).toHaveLength(0);
  });

  it("nao permite medir alem do que ja foi pago (delta negativo)", () => {
    const itens = calcularItensElegiveisParaMedicao(
      [etapa({ percentualExecutado: 30 })],
      new Map([["etapa-1", 50]])
    );
    expect(itens).toHaveLength(0);
  });

  it("arredonda o valor medido em duas casas decimais", () => {
    const itens = calcularItensElegiveisParaMedicao(
      [etapa({ valorOrcado: 1000, percentualExecutado: 33.333 })],
      new Map()
    );
    expect(itens[0].valorMedido).toBe(333.33);
  });

  it("processa multiplas etapas independentemente", () => {
    const itens = calcularItensElegiveisParaMedicao(
      [
        etapa({ id: "a", percentualExecutado: 100 }),
        etapa({ id: "b", situacaoQualidade: "reprovado" }),
        etapa({ id: "c", percentualExecutado: 20 }),
      ],
      new Map()
    );
    expect(itens.map((i) => i.etapaId).sort()).toEqual(["a", "c"]);
  });
});

describe("calcularCurvaS", () => {
  it("retorna vazio sem etapas nem despesas com data", () => {
    expect(calcularCurvaS([], [])).toEqual([]);
  });

  it("acumula o realizado so ate o mes de cada despesa", () => {
    const pontos = calcularCurvaS(
      [{ valorOrcado: 1000, dataInicioPrevista: "2026-01-01", dataFimPrevista: "2026-03-31" }],
      [
        { valor: 100, data: "2026-01-15" },
        { valor: 200, data: "2026-02-15" },
      ]
    );
    expect(pontos.length).toBeGreaterThanOrEqual(2);
    const jan = pontos.find((p) => p.mes.startsWith("Jan"));
    const fev = pontos.find((p) => p.mes.startsWith("Fev"));
    expect(jan?.realizado).toBe(100);
    expect(fev?.realizado).toBe(300);
  });

  it("previsto chega no valor orcado total no fim da etapa", () => {
    const pontos = calcularCurvaS(
      [{ valorOrcado: 5000, dataInicioPrevista: "2026-01-01", dataFimPrevista: "2026-01-31" }],
      []
    );
    const ultimo = pontos[pontos.length - 1];
    expect(ultimo.previsto).toBe(5000);
  });

  it("ignora etapas sem data prevista completa", () => {
    const pontos = calcularCurvaS(
      [{ valorOrcado: 1000, dataInicioPrevista: null, dataFimPrevista: null }],
      [{ valor: 50, data: "2026-05-01" }]
    );
    expect(pontos.every((p) => p.previsto === 0)).toBe(true);
  });
});
