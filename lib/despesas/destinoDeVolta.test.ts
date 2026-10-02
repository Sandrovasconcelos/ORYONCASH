import { describe, expect, it } from "vitest";
import { destinoDeVolta } from "./destinoDeVolta";

const PADRAO = "/dashboard/despesas";

describe("destinoDeVolta", () => {
  it("mantém a lista com filtros e página", () => {
    expect(destinoDeVolta("/dashboard/despesas?obra=abc&pagina=3&porPagina=50", PADRAO)).toBe(
      "/dashboard/despesas?obra=abc&pagina=3&porPagina=50"
    );
    expect(destinoDeVolta("/dashboard/despesas?busca=a%C3%A7o+inox", PADRAO)).toBe(
      "/dashboard/despesas?busca=a%C3%A7o+inox"
    );
    expect(destinoDeVolta("/dashboard/despesas", PADRAO)).toBe("/dashboard/despesas");
  });

  it("rejeita destinos fora da lista de lançamentos", () => {
    for (const ruim of [
      "https://evil.com",
      "//evil.com",
      "/dashboard/lixeira",
      "/dashboard/despesas/../lixeira",
      "/dashboard/despesas/calendario",
      "/dashboard/despesasx",
      "javascript:alert(1)",
      "/dashboard/despesas?x=<script>",
      "/dashboard/despesas?x=1\nSet-Cookie:a=b",
      "",
    ]) {
      expect(destinoDeVolta(ruim, PADRAO)).toBe(PADRAO);
    }
  });
});
