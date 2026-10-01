import { describe, expect, it } from "vitest";
import { detectarAjusteDesconto } from "./rateioDesconto";
import type { InvoiceItem } from "./extractInvoice";

const item = (descricao: string, quantidade: number, valorUnitario: number): InvoiceItem => ({
  descricao,
  quantidade,
  valorUnitario,
  valorTotal: Math.round(quantidade * valorUnitario * 100) / 100,
});

describe("detectarAjusteDesconto", () => {
  it("sem total da nota (ou igual a soma), nao ha ajuste", () => {
    const itens = [item("A", 1, 100), item("B", 1, 200)];
    expect(detectarAjusteDesconto(itens, null)).toBeNull();
    expect(detectarAjusteDesconto(itens, 300)).toBeNull();
  });

  it("detecta o desconto da nota real do usuario (115 itens, resumido a 2 pra teste)", () => {
    const itens = [item("Martelo", 1, 4912.08), item("Trilho", 4, 228.225)];
    const somaOriginal = itens.reduce((s, i) => s + i.valorTotal, 0);
    expect(somaOriginal).toBeCloseTo(5824.98, 2);

    const ajuste = detectarAjusteDesconto(itens, 5277.87);
    expect(ajuste).toEqual({ valorItens: 5824.98, valorFinal: 5277.87, diferenca: 547.11 });
  });

  it("nao altera os itens recebidos - so informa o ajuste", () => {
    const itens = [item("Cimento", 10, 50)];
    const copia = JSON.parse(JSON.stringify(itens));
    detectarAjusteDesconto(itens, 450);
    expect(itens).toEqual(copia);
  });

  it("frete nao itemizado (total maior que a soma) tambem e detectado, com diferenca negativa", () => {
    const itens = [item("A", 1, 100), item("B", 1, 100)];
    const ajuste = detectarAjusteDesconto(itens, 220);
    expect(ajuste).toEqual({ valorItens: 200, valorFinal: 220, diferenca: -20 });
  });

  it("diferenca fora da faixa razoavel (provavel erro de leitura) nao gera ajuste", () => {
    const itens = [item("A", 1, 1000)];
    // total da nota 10x menor que a soma dos itens - mais provavel erro do que desconto de 90%
    expect(detectarAjusteDesconto(itens, 100)).toBeNull();
  });

  it("sem itens ou soma zero, nao ha ajuste", () => {
    expect(detectarAjusteDesconto([], 100)).toBeNull();
    expect(detectarAjusteDesconto([item("A", 1, 0)], 100)).toBeNull();
  });
});
