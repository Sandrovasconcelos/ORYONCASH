import { describe, expect, it } from "vitest";
import { formatarNotificacaoLancamento } from "./notificacoes";

const base = {
  valor: 8000,
  categoriaNome: "Material",
  obraNome: "02 Costa Amalfitana",
  autorNome: "Leo",
  descricao: "Parcela do pagamento de lajes",
  materialNome: null,
  documentoAnexado: "comprovante_pagamento" as const,
};

describe("formatarNotificacaoLancamento", () => {
  it("mostra quem lancou, por onde e quando", () => {
    const m = formatarNotificacaoLancamento({ ...base, origemRotulo: "Telegram", horario: "2026-09-25T18:38:00Z" });
    expect(m).toContain("👤 Lançado por: Leo pelo Telegram às 15:38");
  });

  it("inclui etapa, fornecedor, quantidade, data e progresso da obra", () => {
    const m = formatarNotificacaoLancamento({
      ...base,
      etapaNome: "SUPRA-ESTRUTURA",
      fornecedorNome: "Martins Premoldados",
      quantidade: 4,
      valorUnitario: 96,
      data: "2026-09-16",
      obraOrcamento: 100000,
      obraGasto: 25000,
    });
    expect(m).toContain("📐 SUPRA-ESTRUTURA");
    expect(m).toContain("🏢 Fornecedor: Martins Premoldados");
    expect(m).toContain("🔢 4 × ");
    expect(m).toContain("📅 Data do gasto: 16/09/2026");
    expect(m).toContain("(25%)");
  });

  it("continua funcionando so com os campos antigos", () => {
    const m = formatarNotificacaoLancamento({ ...base, documentoAnexado: null });
    expect(m).toContain("Nota/conta: não anexada");
    expect(m).toContain("ainda não anexado");
    expect(m).not.toContain("Lançado por: undefined");
  });
});
