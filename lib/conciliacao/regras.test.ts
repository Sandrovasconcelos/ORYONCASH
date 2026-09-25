import { describe, expect, it } from "vitest";
import { chaveDaTransacao } from "./regras";

describe("chaveDaTransacao", () => {
  it("usa o beneficiario, sem acento nem caixa", () => {
    expect(chaveDaTransacao("DEB PIX QR COD DIN - Marsol Distribuido")).toBe("marsol distribuido");
    expect(chaveDaTransacao("DEB PIX CHAVE - José  da   Silva")).toBe("jose da silva");
  });

  it("mesmo beneficiario por canais diferentes cai na mesma chave", () => {
    expect(chaveDaTransacao("DEB PIX QR COD EST - Rofe Distribuidora")).toBe(
      chaveDaTransacao("DEB PIX QR COD DIN - Rofe Distribuidora")
    );
  });

  it("sem beneficiario usa a descricao sem numeros", () => {
    expect(chaveDaTransacao("TARIFA MANUTENCAO CONTA A")).toBe("tarifa manutencao conta a");
    expect(chaveDaTransacao("TAR PIX 08/2026")).toBe("tar pix");
  });

  it("descricao vazia ou curta demais nao gera chave", () => {
    expect(chaveDaTransacao(null)).toBeNull();
    expect(chaveDaTransacao("")).toBeNull();
    expect(chaveDaTransacao("12")).toBeNull();
  });
});
