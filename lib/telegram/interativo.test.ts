import { describe, expect, it } from "vitest";
import {
  extrairItensNumerados,
  mensagemComEscolha,
  POR_PAGINA,
  rotuloDoBotao,
  tecladoDaPagina,
  tecladoLancamento,
} from "./interativo";

const lista = (n: number) =>
  ["🏗️ Escolha a obra:", ...Array.from({ length: n }, (_, i) => `${i + 1}. Obra ${i + 1}`), "", "Responda com o número ou o nome."].join(
    "\n"
  );

describe("extrairItensNumerados", () => {
  it("le as linhas numeradas de uma lista de selecao", () => {
    expect(extrairItensNumerados(lista(3))).toEqual([
      { numero: 1, rotulo: "Obra 1" },
      { numero: 2, rotulo: "Obra 2" },
      { numero: 3, rotulo: "Obra 3" },
    ]);
  });

  it("ignora texto numerado sem o rodape de resposta", () => {
    expect(extrairItensNumerados("Passos:\n1. Um\n2. Dois")).toEqual([]);
  });

  it("ignora lista com um item so", () => {
    expect(extrairItensNumerados(lista(1))).toEqual([]);
  });
});

describe("tecladoDaPagina", () => {
  const itens = extrairItensNumerados(lista(POR_PAGINA + 4));

  it("primeira pagina tem POR_PAGINA botoes e navegacao pra frente", () => {
    const t = tecladoDaPagina(itens, 0);
    expect(t).toHaveLength(POR_PAGINA + 1);
    expect(t[0][0].callback_data).toBe("n:1");
    const nav = t[t.length - 1];
    expect(nav[0].callback_data).toBe("pg:x");
    expect(nav[2].callback_data).toBe("pg:1");
  });

  it("ultima pagina traz o resto e navegacao pra tras", () => {
    const t = tecladoDaPagina(itens, 1);
    expect(t).toHaveLength(4 + 1);
    const nav = t[t.length - 1];
    expect(nav[0].callback_data).toBe("pg:0");
    expect(nav[2].callback_data).toBe("pg:x");
  });

  it("pagina fora do intervalo e limitada", () => {
    expect(tecladoDaPagina(itens, 99)[0][0].callback_data).toBe(`n:${POR_PAGINA + 1}`);
  });

  it("lista curta nao tem barra de paginas", () => {
    expect(tecladoDaPagina(extrairItensNumerados(lista(3)), 0)).toHaveLength(3);
  });

  it("callback_data cabe no limite de 64 bytes", () => {
    for (const linha of tecladoDaPagina(itens, 0)) {
      for (const b of linha) expect(Buffer.byteLength(b.callback_data ?? "")).toBeLessThanOrEqual(64);
    }
  });
});

describe("mensagemComEscolha", () => {
  it("lista longa vira so o titulo + escolha", () => {
    const r = mensagemComEscolha(lista(20), [], "3. Obra 3");
    expect(r.texto).toBe("🏗️ Escolha a obra:\n\n✅ 3. Obra 3");
  });

  it("mensagem sem lista mantem o texto e acrescenta a escolha", () => {
    expect(mensagemComEscolha("Deseja continuar?", [], "Sim").texto).toBe("Deseja continuar?\n\n✅ Sim");
  });

  it("descarta entidades que ficaram fora do texto novo", () => {
    const texto = lista(5);
    const r = mensagemComEscolha(texto, [{ type: "bold", offset: 0, length: 5 }, { type: "bold", offset: 60, length: 4 }], "1. Obra 1");
    expect(r.entidades).toEqual([{ type: "bold", offset: 0, length: 5 }]);
  });
});

describe("rotuloDoBotao", () => {
  it("acha o texto do botao pelo callback_data", () => {
    expect(rotuloDoBotao([[{ text: "Sim", callback_data: "confirm:sim" }]], "confirm:sim")).toBe("Sim");
    expect(rotuloDoBotao([[{ text: "Sim", callback_data: "confirm:sim" }]], "outro")).toBeNull();
    expect(rotuloDoBotao(undefined, "x")).toBeNull();
  });
});

describe("tecladoLancamento", () => {
  const id = "0b9f3c5e-1111-4222-8333-444455556666";

  it("oferece corrigir, comprovante, desfazer e link", () => {
    const dados = tecladoLancamento(id, { comComprovante: false }).flat();
    expect(dados.map((b) => b.callback_data ?? b.url)).toEqual([
      `cr:${id}`,
      `ap:${id}`,
      `dz:${id}`,
      "https://oryoncash.vercel.app/dashboard/despesas",
    ]);
  });

  it("sem botao de comprovante quando o lancamento ja nasceu com ele", () => {
    const dados = tecladoLancamento(id, { comComprovante: true }).flat();
    expect(dados.some((b) => b.callback_data?.startsWith("ap:"))).toBe(false);
  });

  it("callback_data dentro do limite de 64 bytes", () => {
    for (const b of tecladoLancamento(id, { comComprovante: false }).flat()) {
      expect(Buffer.byteLength(b.callback_data ?? "")).toBeLessThanOrEqual(64);
    }
  });
});
