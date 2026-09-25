import { describe, expect, it } from "vitest";
import { decidirAviso, INTERVALO_LEMBRETE_MS } from "./decisao";

const AGORA = Date.parse("2026-09-25T12:00:00Z");
const iso = (msAtras: number) => new Date(AGORA - msAtras).toISOString();

describe("decidirAviso", () => {
  it("primeira checagem saudavel nao avisa", () => {
    expect(decidirAviso(null, true, AGORA)).toBeNull();
  });

  it("primeira checagem com problema avisa", () => {
    expect(decidirAviso(null, false, AGORA)).toBe("problema");
  });

  it("ok -> problema avisa", () => {
    expect(decidirAviso({ ok: true, ultimo_aviso_em: null }, false, AGORA)).toBe("problema");
  });

  it("problema -> ok avisa recuperacao", () => {
    expect(decidirAviso({ ok: false, ultimo_aviso_em: iso(1000) }, true, AGORA)).toBe("recuperado");
  });

  it("ok -> ok fica quieto", () => {
    expect(decidirAviso({ ok: true, ultimo_aviso_em: null }, true, AGORA)).toBeNull();
  });

  it("problema persistente so lembra depois de 72h", () => {
    expect(decidirAviso({ ok: false, ultimo_aviso_em: iso(INTERVALO_LEMBRETE_MS - 60_000) }, false, AGORA)).toBeNull();
    expect(decidirAviso({ ok: false, ultimo_aviso_em: iso(INTERVALO_LEMBRETE_MS + 60_000) }, false, AGORA)).toBe(
      "lembrete"
    );
  });

  it("problema persistente sem aviso anterior lembra", () => {
    expect(decidirAviso({ ok: false, ultimo_aviso_em: null }, false, AGORA)).toBe("lembrete");
  });
});
