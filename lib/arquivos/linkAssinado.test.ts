import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkDeDownload, linkValido } from "./linkAssinado";
import { caminhoNoDrive } from "./pastaNoDrive";

describe("link assinado", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_SECRET = "segredo-de-teste";
  });
  afterEach(() => vi.useRealTimers());

  const partes = (url: string) => {
    const u = new URL(url);
    return { exp: u.searchParams.get("exp"), sig: u.searchParams.get("sig") };
  };

  it("aceita o link recem gerado", () => {
    const { exp, sig } = partes(linkDeDownload("https://x.app", "abc"));
    expect(linkValido("abc", exp, sig)).toBe(true);
  });
  it("recusa outro arquivo, assinatura adulterada e link expirado", () => {
    const { exp, sig } = partes(linkDeDownload("https://x.app", "abc"));
    expect(linkValido("outro", exp, sig)).toBe(false);
    expect(linkValido("abc", exp, `${sig}x`)).toBe(false);
    expect(linkValido("abc", String(Number(exp) + 1), sig)).toBe(false);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 3600 * 1000);
    expect(linkValido("abc", exp, sig)).toBe(false);
  });
  it("sem parametros nao vale", () => {
    expect(linkValido("abc", null, null)).toBe(false);
  });
});

describe("caminhoNoDrive", () => {
  it("espelha area / pasta / tipo", () => {
    expect(caminhoNoDrive({ area: "obra", pastaNome: "Villa Borghese", tipo: "Terreno e matrícula" })).toEqual(["Obras", "Villa Borghese", "Terreno e matrícula"]);
    expect(caminhoNoDrive({ area: "obra", pastaNome: null, tipo: "Outros" })).toEqual(["Obras", "Sem obra definida", "Outros"]);
    expect(caminhoNoDrive({ area: "empresa", pastaNome: null, tipo: "Certidões" })).toEqual(["Empresa", "Certidões"]);
  });
});
