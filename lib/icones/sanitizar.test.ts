import { describe, expect, it } from "vitest";
import { sanitizarSvgInterno } from "./sanitizar";

describe("sanitizarSvgInterno", () => {
  it("aceita desenho simples e remove o <svg> externo", () => {
    const r = sanitizarSvgInterno(
      `<svg viewBox="0 0 48 48"><rect x="5" y="5" width="20" height="20" rx="3" fill="#D9603B"/><circle cx="30" cy="30" r="6" fill="#fff"/></svg>`
    );
    expect(r).toBe(`<rect x="5" y="5" width="20" height="20" rx="3" fill="#D9603B"/><circle cx="30" cy="30" r="6" fill="#fff"/>`);
  });

  it("aceita grupos com transform e paths", () => {
    expect(
      sanitizarSvgInterno(`<g transform="rotate(30 24 24)"><path d="M10 10L20 20" stroke="#000" stroke-width="2"/></g>`)
    ).not.toBeNull();
  });

  it("rejeita script, eventos e tags desconhecidas", () => {
    expect(sanitizarSvgInterno(`<script>alert(1)</script><rect x="1" y="1" width="2" height="2"/>`)).toBeNull();
    expect(sanitizarSvgInterno(`<rect x="1" y="1" width="2" height="2" onclick="x()"/>`)).toBeNull();
    expect(sanitizarSvgInterno(`<image href="http://x/y.png"/>`)).toBeNull();
    expect(sanitizarSvgInterno(`<foreignObject><div/></foreignObject>`)).toBeNull();
  });

  it("rejeita referencias externas em valores", () => {
    expect(sanitizarSvgInterno(`<rect x="1" y="1" width="2" height="2" fill="url(#a)"/>`)).toBeNull();
    expect(sanitizarSvgInterno(`<rect x="1" y="1" width="2" height="2" fill="javascript:x"/>`)).toBeNull();
  });

  it("rejeita vazio, so grupo vazio ou texto solto", () => {
    expect(sanitizarSvgInterno("")).toBeNull();
    expect(sanitizarSvgInterno(`<g></g>`)).toBeNull();
    expect(sanitizarSvgInterno(`oi <rect x="1" y="1" width="2" height="2"/>`)).toBeNull();
  });
});
