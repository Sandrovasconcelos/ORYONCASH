import { describe, expect, it } from "vitest";
import { classificarAutomaticamente } from "./auto";
import { calcularFechamento, limitesDoMes, nomeDoMes, SEM_OBRA } from "./fechamento";
import { classificacoesDoTipo, ehTransferencia, rotuloCurto } from "./tipos";

describe("classificarAutomaticamente", () => {
  it("reconhece resgate, rendimento e aplicacao", () => {
    expect(classificarAutomaticamente("RESGATE CDB AUTOMATICO", "credito")).toBe("resgate");
    expect(classificarAutomaticamente("RENDIMENTO APLICACAO", "credito")).toBe("rendimento");
    expect(classificarAutomaticamente("APLIC. FDO AUTOMATICO", "debito")).toBe("aplicacao");
    expect(classificarAutomaticamente("APLICACAO CDB", "debito")).toBe("aplicacao");
  });
  it("nao adivinha o resto", () => {
    expect(classificarAutomaticamente("PIX RECEBIDO - Joao da Silva", "credito")).toBeNull();
    expect(classificarAutomaticamente("DEB PIX - Marsol", "debito")).toBeNull();
    expect(classificarAutomaticamente(null, "credito")).toBeNull();
  });
});

describe("tipos", () => {
  it("separa entradas e saidas e marca transferencias", () => {
    expect(classificacoesDoTipo("credito").map((c) => c.id)).toEqual(["venda", "aporte", "rendimento", "outra_entrada", "resgate"]);
    expect(classificacoesDoTipo("debito").map((c) => c.id)).toEqual(["aplicacao", "outra_saida"]);
    expect(ehTransferencia("resgate")).toBe(true);
    expect(ehTransferencia("venda")).toBe(false);
    expect(rotuloCurto(null)).toBe("Sem classificação");
  });
});

describe("calcularFechamento", () => {
  const transacoes = [
    { tipo: "credito" as const, valor: 100000, classificacao: "venda", despesaId: null, obraNome: null },
    { tipo: "credito" as const, valor: 150000, classificacao: "aporte", despesaId: null, obraNome: null },
    { tipo: "credito" as const, valor: 4120, classificacao: "rendimento", despesaId: null, obraNome: null },
    { tipo: "credito" as const, valor: 100000, classificacao: "resgate", despesaId: null, obraNome: null },
    { tipo: "credito" as const, valor: 3500, classificacao: null, despesaId: null, obraNome: null },
    { tipo: "debito" as const, valor: 182300, classificacao: null, despesaId: "d1", obraNome: "Obra 01" },
    { tipo: "debito" as const, valor: 96540, classificacao: null, despesaId: "d2", obraNome: "Obra 02" },
    { tipo: "debito" as const, valor: 5000, classificacao: null, despesaId: "d3", obraNome: null },
    { tipo: "debito" as const, valor: 50000, classificacao: "aplicacao", despesaId: null, obraNome: null },
    { tipo: "debito" as const, valor: 1200, classificacao: null, despesaId: null, obraNome: null },
  ];

  it("soma entradas, saidas e transferencias", () => {
    const f = calcularFechamento({ saldoInicial: 41870, saldoFinalInformado: null, transacoes });
    expect(f.entradas).toEqual({ venda: 100000, aporte: 150000, rendimento: 4120, outraEntrada: 0, naoClassificadas: 3500, total: 257620 });
    expect(f.transferencias).toEqual({ resgates: 100000, aplicacoes: 50000 });
    expect(f.saidas.porObra).toEqual([
      { nome: "Obra 01", total: 182300 },
      { nome: "Obra 02", total: 96540 },
      { nome: SEM_OBRA, total: 5000 },
    ]);
    expect(f.saidas.naoClassificadas).toBe(1200);
    expect(f.naoClassificadas).toBe(2);
  });

  it("saldo final = inicial + creditos - debitos (transferencias entram)", () => {
    const f = calcularFechamento({ saldoInicial: 41870, saldoFinalInformado: null, transacoes });
    // creditos 357620 - debitos 335040
    expect(f.saldoFinalCalculado).toBe(64450);
    expect(f.diferenca).toBeNull();
  });

  it("calcula a diferenca contra o saldo do banco", () => {
    const f = calcularFechamento({ saldoInicial: 41870, saldoFinalInformado: 64450, transacoes });
    expect(f.diferenca).toBe(0);
    expect(calcularFechamento({ saldoInicial: 41870, saldoFinalInformado: 64000, transacoes }).diferenca).toBe(-450);
  });

  it("sem saldo inicial nao calcula saldo final", () => {
    const f = calcularFechamento({ saldoInicial: null, saldoFinalInformado: 100, transacoes });
    expect(f.saldoFinalCalculado).toBeNull();
    expect(f.diferenca).toBeNull();
  });
});

describe("meses", () => {
  it("limites do mes", () => {
    expect(limitesDoMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28", anterior: "2026-01", proximo: "2026-03" });
    expect(limitesDoMes("2026-01")?.anterior).toBe("2025-12");
    expect(limitesDoMes("2026-12")?.proximo).toBe("2027-01");
    expect(limitesDoMes("2026-13")).toBeNull();
    expect(limitesDoMes("abc")).toBeNull();
  });
  it("nome do mes", () => {
    expect(nomeDoMes("2026-10")).toBe("outubro de 2026");
  });
});

import { lerSaldoBR } from "./saldo";

describe("lerSaldoBR", () => {
  it("aceita positivo, zero e negativo", () => {
    expect(lerSaldoBR("1.234,56")).toBe(1234.56);
    expect(lerSaldoBR("R$ 48.230,00")).toBe(48230);
    expect(lerSaldoBR("0")).toBe(0);
    expect(lerSaldoBR("-500,10")).toBe(-500.1);
  });
  it("rejeita vazio e lixo", () => {
    expect(lerSaldoBR("")).toBeNull();
    expect(lerSaldoBR("abc")).toBeNull();
    expect(lerSaldoBR("-")).toBeNull();
  });
});

import { calcularAbertura, diaAnterior, escolherSaldoBase, rendimentoImplicito } from "./fechamento";

describe("abertura do mes", () => {
  it("escolhe o saldo mais recente ate o limite", () => {
    const base = escolherSaldoBase(
      [
        { data: "2026-06-30", valor: 10, origem: "informado" },
        { data: "2026-08-31", valor: 20, origem: "informado" },
        { data: "2026-10-31", valor: 30, origem: "informado" },
      ],
      "2026-09-30"
    );
    expect(base).toEqual({ data: "2026-08-31", valor: 20, origem: "informado" });
    expect(escolherSaldoBase([{ data: "2026-10-31", valor: 30, origem: "informado" }], "2026-09-30")).toBeNull();
  });
  it("empate de data: vale o informado do extrato", () => {
    const base = escolherSaldoBase(
      [
        { data: "2026-08-31", valor: 5, origem: "conta" },
        { data: "2026-08-31", valor: 7, origem: "informado" },
      ],
      "2026-09-30"
    );
    expect(base?.valor).toBe(7);
  });
  it("soma os movimentos entre a base e o fim do mes anterior", () => {
    const base = { data: "2026-08-31", valor: 1000, origem: "informado" as const };
    const a = calcularAbertura(base, [
      { tipo: "credito", valor: 500 },
      { tipo: "debito", valor: 200.5 },
    ]);
    expect(a).toEqual({ valor: 1299.5, base, ajustadoPor: 2 });
    expect(calcularAbertura(null, [])).toBeNull();
  });
  it("dia anterior", () => {
    expect(diaAnterior("2026-10-01")).toBe("2026-09-30");
    expect(diaAnterior("2026-01-01")).toBe("2025-12-31");
  });
});

describe("rendimento implicito", () => {
  it("posicao final - inicial - aplicacoes + resgates", () => {
    expect(rendimentoImplicito({ posicaoInicial: 660280, posicaoFinal: 612400, aplicacoes: 50000, resgates: 100000 })).toBe(2120);
    expect(rendimentoImplicito({ posicaoInicial: null, posicaoFinal: 1, aplicacoes: 0, resgates: 0 })).toBeNull();
  });
});
