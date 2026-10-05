import { beforeEach, describe, expect, it, vi } from "vitest";

let resposta: { data: { ok: boolean } | null; error: unknown } = { data: null, error: null };
let leituras = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            leituras += 1;
            return resposta;
          },
        }),
      }),
    }),
  }),
}));

import { limparCacheCanalForaDoAr, whatsappForaDoAr } from "./canalForaDoAr";

describe("whatsappForaDoAr", () => {
  beforeEach(() => {
    limparCacheCanalForaDoAr();
    leituras = 0;
  });

  it("true quando o monitor marcou o WhatsApp como fora do ar", async () => {
    resposta = { data: { ok: false }, error: null };
    expect(await whatsappForaDoAr()).toBe(true);
  });

  it("false quando está ok, sem registro ou com erro de leitura", async () => {
    resposta = { data: { ok: true }, error: null };
    expect(await whatsappForaDoAr()).toBe(false);
    limparCacheCanalForaDoAr();
    resposta = { data: null, error: null };
    expect(await whatsappForaDoAr()).toBe(false);
    limparCacheCanalForaDoAr();
    resposta = { data: { ok: false }, error: { message: "tabela ausente" } };
    expect(await whatsappForaDoAr()).toBe(false);
  });

  it("não lê o banco de novo dentro do tempo de cache", async () => {
    resposta = { data: { ok: false }, error: null };
    await whatsappForaDoAr();
    await whatsappForaDoAr();
    await whatsappForaDoAr();
    expect(leituras).toBe(1);
  });
});
