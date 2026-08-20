import { describe, it, expect } from "vitest";
import { parseValorBR, formatBRL } from "./format";

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
