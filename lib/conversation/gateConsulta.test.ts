import { describe, expect, it } from "vitest";
import { pareceConsulta } from "./gateConsulta";

describe("pareceConsulta", () => {
  it.each([
    "quanto eu já gastei com cimento?",
    "Quanto gastei com a mão de obra do Alex",
    "qual fornecedor mais gastou essa semana?",
    "quanto falta do orçamento da obra costa amalfitana?",
    "quanto do orçamento já usei?",
    "gastei mais ou menos que o mês passado?",
    "comparar meus gastos com a semana passada",
    "quanto eu devo?",
    "o que vence essa semana?",
    "quais contas a pagar tenho?",
    "tem boleto vencido?",
  ])("passa: %s", (texto) => {
    expect(pareceConsulta(texto)).toBe(true);
  });

  it.each([
    "cimento 350 costa 02",
    "oi, bom dia",
    "menu",
    "150,00",
    "Pagamento de energia da casa 07",
    "boleto da luz",
    "ok",
  ])("não passa: %s", (texto) => {
    expect(pareceConsulta(texto)).toBe(false);
  });
});
