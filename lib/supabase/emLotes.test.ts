import { describe, expect, it } from "vitest";
import { consultarEmLotes, dividirEmLotes } from "./emLotes";

describe("dividirEmLotes", () => {
  it("parte em lotes do tamanho pedido", () => {
    expect(dividirEmLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(dividirEmLotes([], 2)).toEqual([]);
  });
});

describe("consultarEmLotes", () => {
  it("junta os resultados de todos os lotes, na ordem", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => i);
    const chamadas: number[] = [];
    const r = await consultarEmLotes(ids, async (lote) => {
      chamadas.push(lote.length);
      return { data: lote.map((id) => ({ id })), error: null };
    });
    expect(chamadas).toEqual([80, 80, 40]);
    expect(r.data).toHaveLength(200);
    expect(r.data[0]).toEqual({ id: 0 });
    expect(r.data[199]).toEqual({ id: 199 });
    expect(r.error).toBeNull();
  });

  it("devolve o primeiro erro, sem derrubar os demais", async () => {
    const r = await consultarEmLotes([1, 2, 3], async (lote) =>
      lote.includes(1) ? { data: null, error: { message: "falhou" } } : { data: [{ ok: true }], error: null }
    );
    expect(r.error?.message).toBe("falhou");
  });

  it("sem ids não consulta nada", async () => {
    let chamou = false;
    const r = await consultarEmLotes([], async () => {
      chamou = true;
      return { data: [], error: null };
    });
    expect(chamou).toBe(false);
    expect(r).toEqual({ data: [], error: null });
  });
});
