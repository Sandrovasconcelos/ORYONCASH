import { describe, expect, it } from "vitest";
import { montarEnvioWhatsApp } from "./botoes";
import { tecladoLancamento, tecladoContasAPagar } from "@/lib/telegram/interativo";
import { cartaoDoPagamento } from "@/lib/conciliacao/avisos";

const id = "0b9f3c5e-1111-4222-8333-444455556666";

describe("montarEnvioWhatsApp", () => {
  it("sem botoes de resposta vira texto puro, com os links no fim", () => {
    const envio = montarEnvioWhatsApp("Alerta", [[{ text: "🌐 Abrir dashboard", url: "https://x.test/d" }]]);
    expect(envio).toEqual({ tipo: "texto", corpo: "Alerta\n\n🌐 Abrir dashboard: https://x.test/d" });
  });

  it("aviso de lancamento cabe em 3 botoes e o link vai no texto", () => {
    const envio = montarEnvioWhatsApp("Novo lançamento", tecladoLancamento(id, { comComprovante: false }));
    expect(envio.tipo).toBe("botoes");
    if (envio.tipo !== "botoes") return;
    expect(envio.botoes.map((b) => b.id)).toEqual([`cr:${id}`, `ap:${id}`, `dz:${id}`]);
    expect(envio.corpo).toContain("Ver lançamentos: https://oryoncash.vercel.app/dashboard/despesas");
  });

  it("titulos dos botoes cabem no limite de 20 caracteres do WhatsApp", () => {
    const envio = montarEnvioWhatsApp("x", tecladoLancamento(id, { comComprovante: false }));
    if (envio.tipo !== "botoes") throw new Error("esperava botoes");
    for (const b of envio.botoes) expect([...b.title].length).toBeLessThanOrEqual(20);
  });

  it("mais de 3 acoes viram lista (titulo curto + descricao)", () => {
    const contas = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, descricao: `Conta de energia numero ${i}` }));
    const envio = montarEnvioWhatsApp("Contas", tecladoContasAPagar(contas));
    expect(envio.tipo).toBe("lista");
    if (envio.tipo !== "lista") return;
    expect(envio.itens).toHaveLength(8); // o teclado de contas limita em 8
    expect(envio.itens[0].id).toBe("cp:c0");
    for (const item of envio.itens) expect([...item.title].length).toBeLessThanOrEqual(24);
    expect(envio.itens[0].description).toContain("Conta de energia");
  });

  it("cartao de pagamento sem vinculo tem 3 botoes; com vinculo vira lista", () => {
    const p = { id, data: "2026-08-11", descricao: "DEB PIX - Marsol", valor: 174.94 };
    const sem = montarEnvioWhatsApp("c", cartaoDoPagamento(p, undefined).botoes);
    expect(sem.tipo).toBe("botoes");
    const com = montarEnvioWhatsApp(
      "c",
      cartaoDoPagamento(p, undefined, {
        transacaoId: id,
        despesaId: "d1",
        despesaData: "2026-08-20",
        despesaValor: 174.94,
        despesaDescricao: null,
        itens: 1,
        transacaoData: "2026-08-11",
        dias: 9,
      }).botoes
    );
    expect(com.tipo).toBe("lista");
    if (com.tipo === "lista") expect(com.itens.map((i) => i.id.slice(0, 2))).toEqual(["xv", "xl", "xi", "xs"]);
  });
});
