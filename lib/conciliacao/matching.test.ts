import { describe, it, expect } from "vitest";
import { casarTransacoes } from "./matching";

describe("casarTransacoes", () => {
  it("casa transacao de debito com despesa de mesmo valor e data", () => {
    const resultado = casarTransacoes(
      [{ id: "t1", data: "2026-08-10", valor: 500, tipo: "debito" }],
      [{ id: "d1", data: "2026-08-10", valor: 500 }]
    );
    expect(resultado.get("t1")).toBe("d1");
  });

  it("nao casa credito com nenhuma despesa", () => {
    const resultado = casarTransacoes(
      [{ id: "t1", data: "2026-08-10", valor: 500, tipo: "credito" }],
      [{ id: "d1", data: "2026-08-10", valor: 500 }]
    );
    expect(resultado.size).toBe(0);
  });

  it("casa mesmo com pequena diferenca de data (dentro da janela)", () => {
    const resultado = casarTransacoes(
      [{ id: "t1", data: "2026-08-12", valor: 500, tipo: "debito" }],
      [{ id: "d1", data: "2026-08-10", valor: 500 }]
    );
    expect(resultado.get("t1")).toBe("d1");
  });

  it("nao casa fora da janela de dias", () => {
    const resultado = casarTransacoes(
      [{ id: "t1", data: "2026-08-20", valor: 500, tipo: "debito" }],
      [{ id: "d1", data: "2026-08-10", valor: 500 }]
    );
    expect(resultado.size).toBe(0);
  });

  it("nao casa fora da tolerancia de valor", () => {
    const resultado = casarTransacoes(
      [{ id: "t1", data: "2026-08-10", valor: 500.5, tipo: "debito" }],
      [{ id: "d1", data: "2026-08-10", valor: 500 }]
    );
    expect(resultado.size).toBe(0);
  });

  it("nao casa quando ha ambiguidade (duas despesas candidatas)", () => {
    const resultado = casarTransacoes(
      [{ id: "t1", data: "2026-08-10", valor: 500, tipo: "debito" }],
      [
        { id: "d1", data: "2026-08-10", valor: 500 },
        { id: "d2", data: "2026-08-11", valor: 500 },
      ]
    );
    expect(resultado.size).toBe(0);
  });

  it("nao usa a mesma despesa em duas transacoes diferentes", () => {
    const resultado = casarTransacoes(
      [
        { id: "t1", data: "2026-08-10", valor: 500, tipo: "debito" },
        { id: "t2", data: "2026-08-10", valor: 500, tipo: "debito" },
      ],
      [{ id: "d1", data: "2026-08-10", valor: 500 }]
    );
    expect(resultado.size).toBe(1);
    const despesasUsadas = new Set(resultado.values());
    expect(despesasUsadas.size).toBe(1);
  });

  it("retorna mapa vazio sem transacoes ou despesas", () => {
    expect(casarTransacoes([], []).size).toBe(0);
  });
});

describe("casarTransacoes - pagamentos repetidos de mesmo valor", () => {
  const seisPix = Array.from({ length: 6 }, (_, i) => ({
    id: `t${i}`,
    data: "2026-08-11",
    valor: 3690,
    tipo: "debito" as const,
  }));
  const seisDespesas = (dia: string) =>
    Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, data: dia, valor: 3690 }));

  it("pareia quando a quantidade de transacoes e de lancamentos bate", () => {
    const r = casarTransacoes(seisPix, seisDespesas("2026-08-11"));
    expect(r.size).toBe(6);
    expect(new Set(r.values()).size).toBe(6);
  });

  it("aceita lancamentos alguns dias depois (janela maior no grupo)", () => {
    expect(casarTransacoes(seisPix, seisDespesas("2026-08-16")).size).toBe(6);
  });

  it("nao pareia quando falta um lancamento (deixa pra revisao)", () => {
    expect(casarTransacoes(seisPix, seisDespesas("2026-08-11").slice(0, 5)).size).toBe(0);
  });

  it("nao pareia quando sobra lancamento", () => {
    const sete = [...seisDespesas("2026-08-11"), { id: "d9", data: "2026-08-11", valor: 3690 }];
    expect(casarTransacoes(seisPix, sete).size).toBe(0);
  });
});
