import { describe, expect, it } from "vitest";
import { mesmoNumero } from "./dono";

describe("mesmoNumero", () => {
  it("ignora o 9 depois do DDD e a formatacao", () => {
    expect(mesmoNumero("5598988219864", "559888219864")).toBe(true);
    expect(mesmoNumero("+55 (98) 98821-9864", "5598988219864")).toBe(true);
  });
  it("numeros diferentes", () => {
    expect(mesmoNumero("5598988219864", "5598985290394")).toBe(false);
  });
  it("telegram compara o id inteiro", () => {
    expect(mesmoNumero("tg_264230451", "tg_264230451")).toBe(true);
    expect(mesmoNumero("tg_264230451", "tg_7728816151")).toBe(false);
    expect(mesmoNumero("tg_1", "5598988219864")).toBe(false);
  });
});
