import { describe, it, expect } from "vitest";
import { resolverPorNumeroOuNome } from "./queries";

type Item = { id: string; nome: string };

const itens: Item[] = [
  { id: "1", nome: "Compra de Equipamentos" },
  { id: "2", nome: "Corretagem" },
  { id: "3", nome: "Material" },
];

describe("resolverPorNumeroOuNome", () => {
  it("resolve pelo numero da posicao (1-indexado)", () => {
    expect(resolverPorNumeroOuNome(itens, "1")).toEqual(itens[0]);
    expect(resolverPorNumeroOuNome(itens, "3")).toEqual(itens[2]);
  });

  it("retorna null pra numero fora do intervalo", () => {
    expect(resolverPorNumeroOuNome(itens, "0")).toBeNull();
    expect(resolverPorNumeroOuNome(itens, "99")).toBeNull();
  });

  it("resolve por nome exato, ignorando acento e caixa", () => {
    expect(resolverPorNumeroOuNome(itens, "material")).toEqual(itens[2]);
    expect(resolverPorNumeroOuNome(itens, "CORRETAGEM")).toEqual(itens[1]);
  });

  it("resolve por substring quando ha exatamente um candidato", () => {
    expect(resolverPorNumeroOuNome(itens, "equipamentos")).toEqual(itens[0]);
  });

  it("resolve por nome exato mesmo quando e prefixo de outro item", () => {
    const parecidos: Item[] = [
      { id: "1", nome: "Mão de Obra" },
      { id: "2", nome: "Mão de Obra Alex" },
    ];
    expect(resolverPorNumeroOuNome(parecidos, "mao de obra")).toEqual(parecidos[0]);
  });

  it("nao adivinha quando o texto e ambiguo entre varios itens (substring nos dois)", () => {
    const ambiguo: Item[] = [
      { id: "1", nome: "Mão de Obra Alex" },
      { id: "2", nome: "Mão de Obra Terraplenagem" },
    ];
    expect(resolverPorNumeroOuNome(ambiguo, "obra")).toBeNull();
  });

  it("retorna null pra texto vazio ou sem nenhum candidato", () => {
    expect(resolverPorNumeroOuNome(itens, "")).toBeNull();
    expect(resolverPorNumeroOuNome(itens, "xyz-nao-existe")).toBeNull();
  });
});
