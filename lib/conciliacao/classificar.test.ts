import { describe, expect, it } from "vitest";
import { ehMovimentoFinanceiro, nomeDoBeneficiario } from "./classificar";

describe("ehMovimentoFinanceiro", () => {
  it("reconhece aplicacao e resgate", () => {
    expect(ehMovimentoFinanceiro("APLICACAO FDO - CLIENTE")).toBe(true);
    expect(ehMovimentoFinanceiro("RESGATE FUNDO DE INVESTIMENTO")).toBe(true);
    expect(ehMovimentoFinanceiro("Aplicação CDB")).toBe(true);
  });

  it("nao confunde pagamentos comuns nem tarifas", () => {
    expect(ehMovimentoFinanceiro("DEB PIX QR COD DIN - Marsol Distribuido")).toBe(false);
    expect(ehMovimentoFinanceiro("TARIFA MANUTENCAO CONTA A")).toBe(false);
    expect(ehMovimentoFinanceiro(null)).toBe(false);
  });
});

describe("nomeDoBeneficiario", () => {
  it("pega o nome depois do ultimo ' - '", () => {
    expect(nomeDoBeneficiario("DEB PIX QR COD DIN - Marsol Distribuido")).toBe("Marsol Distribuido");
    expect(nomeDoBeneficiario("ENVIO DE TED - Ivana C S Barbosa")).toBe("Ivana C S Barbosa");
  });

  it("sem separador ou nome curto demais devolve null", () => {
    expect(nomeDoBeneficiario("TAR PIX")).toBeNull();
    expect(nomeDoBeneficiario("PIX - X")).toBeNull();
    expect(nomeDoBeneficiario(undefined)).toBeNull();
  });
});
