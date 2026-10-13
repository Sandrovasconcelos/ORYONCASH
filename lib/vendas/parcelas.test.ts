import { describe, expect, it } from "vitest";
import { gerarParcelas, resumirVenda, situacaoDaParcela, somarMeses, sugerirParcelas } from "./parcelas";

describe("somarMeses", () => {
  it("mantem o dia e ajusta meses curtos", () => {
    expect(somarMeses("2026-10-10", 1, 10)).toBe("2026-11-10");
    expect(somarMeses("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(somarMeses("2026-01-31", 2, 31)).toBe("2026-03-31");
    expect(somarMeses("2026-11-15", 3, 15)).toBe("2027-02-15");
  });
});

describe("gerarParcelas", () => {
  it("entrada + parcelas iguais (caso do cliente)", () => {
    const p = gerarParcelas({ valorTotal: 1_000_000, entradaValor: 400_000, entradaData: "2026-07-20", quantidade: 6, primeiroVencimento: "2026-08-10" });
    expect(p).toHaveLength(7);
    expect(p[0]).toEqual({ numero: 0, tipo: "entrada", vencimento: "2026-07-20", valor: 400_000 });
    expect(p[1]).toEqual({ numero: 1, tipo: "parcela", vencimento: "2026-08-10", valor: 100_000 });
    expect(p[6].vencimento).toBe("2027-01-10");
    expect(p.reduce((s, x) => s + x.valor, 0)).toBe(1_000_000);
  });
  it("a diferenca de centavos vai pra ultima parcela", () => {
    const p = gerarParcelas({ valorTotal: 100, quantidade: 3, primeiroVencimento: "2026-08-10" });
    expect(p.map((x) => x.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(Math.round(p.reduce((s, x) => s + x.valor, 0) * 100)).toBe(10000);
  });
  it("valor de parcela informado", () => {
    const p = gerarParcelas({ valorTotal: 1_000_000, entradaValor: 400_000, quantidade: 3, valorParcela: 100_000, primeiroVencimento: "2026-08-10" });
    expect(p.map((x) => x.valor)).toEqual([400_000, 100_000, 100_000, 100_000]);
  });
  it("so entrada, ou sem parcelas", () => {
    expect(gerarParcelas({ valorTotal: 500, entradaValor: 500, quantidade: 0, primeiroVencimento: "2026-08-10" })).toHaveLength(1);
    expect(gerarParcelas({ valorTotal: 500, quantidade: 0, primeiroVencimento: "2026-08-10" })).toEqual([]);
  });
});

describe("situacao e resumo", () => {
  const parcelas = [
    { status: "recebida" as const, vencimento: "2026-07-20", valor: 400_000, valor_recebido: 400_000 },
    { status: "recebida" as const, vencimento: "2026-08-10", valor: 100_000, valor_recebido: 100_000 },
    { status: "a_receber" as const, vencimento: "2026-09-10", valor: 100_000, valor_recebido: null },
    { status: "a_receber" as const, vencimento: "2026-11-10", valor: 100_000, valor_recebido: null },
    { status: "cancelada" as const, vencimento: "2026-12-10", valor: 100_000, valor_recebido: null },
  ];
  it("situacao da parcela", () => {
    expect(situacaoDaParcela(parcelas[2], "2026-10-13")).toBe("atrasada");
    expect(situacaoDaParcela(parcelas[3], "2026-10-13")).toBe("a_vencer");
    expect(situacaoDaParcela(parcelas[3], "2026-11-10")).toBe("vence_hoje");
    expect(situacaoDaParcela(parcelas[0], "2026-10-13")).toBe("recebida");
    expect(situacaoDaParcela(parcelas[4], "2026-10-13")).toBe("cancelada");
  });
  it("resumo ignora canceladas e conta atrasos", () => {
    expect(resumirVenda(parcelas, "2026-10-13")).toEqual({
      total: 700_000,
      recebido: 500_000,
      aReceber: 200_000,
      atrasado: 100_000,
      percentualPago: 71,
      proxima: { vencimento: "2026-09-10", valor: 100_000 },
      atrasadas: 1,
    });
  });
});

describe("sugerirParcelas", () => {
  const candidatas = [
    { id: "p1", vendaId: "v1", clienteNome: "João da Silva", numero: 4, vencimento: "2026-11-10", valor: 100_000 },
    { id: "p2", vendaId: "v2", clienteNome: "Maria Souza", numero: 2, vencimento: "2026-11-12", valor: 100_000 },
    { id: "p3", vendaId: "v1", clienteNome: "João da Silva", numero: 5, vencimento: "2026-12-10", valor: 100_000 },
    { id: "p4", vendaId: "v3", clienteNome: "Pedro", numero: 1, vencimento: "2026-11-10", valor: 90_000 },
  ];
  it("casa por valor, data e nome", () => {
    const r = sugerirParcelas({ valor: 100_000, data: "2026-11-11", descricao: "PIX RECEBIDO - Maria Souza" }, candidatas);
    expect(r.map((p) => p.id)).toEqual(["p2", "p1", "p3"]);
  });
  it("sem nome, a vencimento mais proximo vem primeiro; outro valor nao entra", () => {
    const r = sugerirParcelas({ valor: 100_000, data: "2026-11-10", descricao: "TED recebida" }, candidatas);
    expect(r[0].id).toBe("p1");
    expect(r.some((p) => p.id === "p4")).toBe(false);
  });
  it("fora da janela de dias nao sugere", () => {
    expect(sugerirParcelas({ valor: 100_000, data: "2027-06-01", descricao: null }, candidatas)).toEqual([]);
  });
});
