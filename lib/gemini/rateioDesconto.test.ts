import { describe, expect, it } from "vitest";
import { rateiarDescontoNosItens } from "./rateioDesconto";
import type { InvoiceItem } from "./extractInvoice";

const item = (descricao: string, quantidade: number, valorUnitario: number): InvoiceItem => ({
  descricao,
  quantidade,
  valorUnitario,
  valorTotal: Math.round(quantidade * valorUnitario * 100) / 100,
});

describe("rateiarDescontoNosItens", () => {
  it("sem total da nota (ou igual a soma), nao mexe nos itens", () => {
    const itens = [item("A", 1, 100), item("B", 1, 200)];
    expect(rateiarDescontoNosItens(itens, null)).toEqual({ itens, ajuste: null });
    expect(rateiarDescontoNosItens(itens, 300).ajuste).toBeNull();
  });

  it("rateia o desconto da nota real do usuario (115 itens, resumido a 2 pra teste)", () => {
    const itens = [item("Martelo", 1, 4912.08), item("Trilho", 4, 228.225)];
    const somaOriginal = itens.reduce((s, i) => s + i.valorTotal, 0);
    expect(somaOriginal).toBeCloseTo(5824.98, 2);

    const { itens: ajustados, ajuste } = rateiarDescontoNosItens(itens, 5277.87);
    expect(ajuste).toEqual({ valorItens: 5824.98, valorFinal: 5277.87, diferenca: 547.11 });

    const somaAjustada = ajustados.reduce((s, i) => s + i.valorTotal, 0);
    expect(somaAjustada).toBeCloseTo(5277.87, 2);
    // cada item caiu na mesma proporcao (~90,6%), nao foi tudo tirado de um so
    for (const [original, ajustadoItem] of itens.map((i, idx) => [i, ajustados[idx]] as const)) {
      expect(ajustadoItem.valorTotal).toBeLessThan(original.valorTotal);
      expect(ajustadoItem.valorTotal / original.valorTotal).toBeCloseTo(5277.87 / 5824.98, 2);
    }
  });

  it("valor unitario tambem cai junto, proporcional ao desconto", () => {
    const itens = [item("Cimento", 10, 50)];
    const { itens: ajustados } = rateiarDescontoNosItens(itens, 450);
    expect(ajustados[0].valorTotal).toBe(450);
    expect(ajustados[0].valorUnitario).toBe(45);
  });

  it("frete nao itemizado (total maior que a soma) tambem rateia, pra cima", () => {
    const itens = [item("A", 1, 100), item("B", 1, 100)];
    const { itens: ajustados, ajuste } = rateiarDescontoNosItens(itens, 220);
    expect(ajuste?.diferenca).toBe(-20);
    const soma = ajustados.reduce((s, i) => s + i.valorTotal, 0);
    expect(soma).toBeCloseTo(220, 2);
  });

  it("diferenca fora da faixa razoavel (provavel erro de leitura) nao mexe em nada", () => {
    const itens = [item("A", 1, 1000)];
    // total da nota 10x menor que a soma dos itens - mais provavel erro do que desconto de 90%
    const { itens: ajustados, ajuste } = rateiarDescontoNosItens(itens, 100);
    expect(ajuste).toBeNull();
    expect(ajustados).toEqual(itens);
  });

  it("sem itens ou soma zero, devolve sem alterar", () => {
    expect(rateiarDescontoNosItens([], 100).ajuste).toBeNull();
    expect(rateiarDescontoNosItens([item("A", 1, 0)], 100).ajuste).toBeNull();
  });
});
