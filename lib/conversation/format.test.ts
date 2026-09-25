import { describe, it, expect } from "vitest";
import { parseValorBR, formatBRL, parseDataCorrecao, dataDePagamentoValida } from "./format";

describe("parseValorBR", () => {
  it("aceita numero simples", () => {
    expect(parseValorBR("500")).toBe(500);
  });

  it("aceita virgula decimal", () => {
    expect(parseValorBR("500,00")).toBe(500);
    expect(parseValorBR("150,50")).toBe(150.5);
  });

  it("aceita separador de milhar com ponto", () => {
    expect(parseValorBR("1.200,50")).toBe(1200.5);
  });

  it("aceita prefixo R$", () => {
    expect(parseValorBR("R$ 150,00")).toBe(150);
    expect(parseValorBR("r$150,00")).toBe(150);
  });

  it("arredonda pra duas casas decimais", () => {
    expect(parseValorBR("10,999")).toBe(11);
  });

  it("rejeita zero e negativos", () => {
    expect(parseValorBR("0")).toBeNull();
    expect(parseValorBR("-50")).toBeNull();
  });

  it("rejeita texto nao numerico", () => {
    expect(parseValorBR("abc")).toBeNull();
    expect(parseValorBR("")).toBeNull();
  });
});

describe("formatBRL", () => {
  it("formata como moeda brasileira", () => {
    expect(formatBRL(1234.5)).toBe(
      (1234.5).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    );
  });

  it("formata zero corretamente", () => {
    expect(formatBRL(0)).toContain("0,00");
  });
});

describe("parseDataCorrecao", () => {
  const hoje = "2026-09-25";

  it("aceita dia/mes usando o ano corrente", () => {
    expect(parseDataCorrecao("19/08", hoje)).toBe("2026-08-19");
    expect(parseDataCorrecao("4-8", hoje)).toBe("2026-08-04");
  });

  it("aceita ano com 2 ou 4 digitos", () => {
    expect(parseDataCorrecao("19/08/2026", hoje)).toBe("2026-08-19");
    expect(parseDataCorrecao("19/08/26", hoje)).toBe("2026-08-19");
  });

  it("aceita hoje e ontem", () => {
    expect(parseDataCorrecao("hoje", hoje)).toBe("2026-09-25");
    expect(parseDataCorrecao("Ontem", hoje)).toBe("2026-09-24");
  });

  it("rejeita datas inexistentes e texto solto", () => {
    expect(parseDataCorrecao("31/02", hoje)).toBeNull();
    expect(parseDataCorrecao("banana", hoje)).toBeNull();
    expect(parseDataCorrecao("32/01", hoje)).toBeNull();
  });
});

describe("dataDePagamentoValida", () => {
  const hoje = "2026-09-25";

  it("aceita data recente e passada", () => {
    expect(dataDePagamentoValida("2026-09-18", hoje)).toBe("2026-09-18");
    expect(dataDePagamentoValida("2026-09-25", hoje)).toBe("2026-09-25");
  });

  it("rejeita futura, muito antiga e formato invalido", () => {
    expect(dataDePagamentoValida("2026-09-26", hoje)).toBeUndefined();
    expect(dataDePagamentoValida("2026-01-01", hoje)).toBeUndefined();
    expect(dataDePagamentoValida("18/09/2026", hoje)).toBeUndefined();
    expect(dataDePagamentoValida(null, hoje)).toBeUndefined();
    expect(dataDePagamentoValida("2026-13-45", hoje)).toBeUndefined();
  });
});
