import { describe, expect, it } from "vitest";
import { corpoDaLista, linhasDaPagina, POR_PAGINA_WHATSAPP, totalDePaginas } from "./listaNumerada";

const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ numero: i + 1, rotulo: `Fornecedor numero ${i + 1}` }));

describe("corpoDaLista", () => {
  it("fica so com o enunciado e tira o rodape padrao", () => {
    const texto = "🏢 *Qual fornecedor?*\n\n1. A\n2. B\n\nResponda com o número ou digite o nome.";
    expect(corpoDaLista(texto)).toBe("🏢 *Qual fornecedor?*");
  });

  it("mantem observacoes extras depois da lista", () => {
    const texto = "🔔 *Quantos dias antes?*\n\n1. 1 dia\n2. 3 dias\n\nResponda com o número da opção, ou digite outro número de dias.";
    expect(corpoDaLista(texto)).toContain("ou digite outro número de dias");
  });
});

describe("linhasDaPagina", () => {
  const lista = itens(27);

  it("27 itens = 4 paginas de ate 8", () => {
    expect(totalDePaginas(27)).toBe(4);
    expect(totalDePaginas(8)).toBe(1);
  });

  it("primeira pagina: 8 itens + Ver mais, e nunca passa de 10 linhas", () => {
    const { linhas } = linhasDaPagina("tk", lista, 0);
    expect(linhas).toHaveLength(POR_PAGINA_WHATSAPP + 1);
    expect(linhas[0].id).toBe("n:1");
    expect(linhas[linhas.length - 1]).toMatchObject({ id: "pg:tk:1", title: "➡️ Ver mais" });
  });

  it("pagina do meio tem Anterior e Ver mais (10 linhas)", () => {
    const { linhas } = linhasDaPagina("tk", lista, 1);
    expect(linhas).toHaveLength(10);
    expect(linhas[0].id).toBe("n:9");
    expect(linhas.map((l) => l.id).slice(-2)).toEqual(["pg:tk:0", "pg:tk:2"]);
  });

  it("ultima pagina so tem Anterior", () => {
    const { linhas, atual } = linhasDaPagina("tk", lista, 3);
    expect(atual).toBe(3);
    expect(linhas.map((l) => l.id)).toEqual(["n:25", "n:26", "n:27", "pg:tk:2"]);
  });

  it("titulos respeitam 24 caracteres e o nome inteiro vai na descricao", () => {
    const { linhas } = linhasDaPagina("tk", [{ numero: 1, rotulo: "Fornecedor com um nome bem comprido mesmo" }, { numero: 2, rotulo: "B" }], 0);
    expect([...linhas[0].title].length).toBeLessThanOrEqual(24);
    expect(linhas[0].description).toBe("Fornecedor com um nome bem comprido mesmo");
    expect(linhas[1].description).toBeUndefined();
  });

  it("pagina fora do intervalo e limitada", () => {
    expect(linhasDaPagina("tk", lista, 99).atual).toBe(3);
    expect(linhasDaPagina("tk", lista, -5).atual).toBe(0);
  });
});
