import { describe, expect, it } from "vitest";
import { buscarArquivos, palavrasDoPedido, type ArquivoBuscavel } from "./busca";
import { lerCorrecao } from "./comandos";
import { legendaPedeGuardar, nomeDoArquivoSugere, pareceBuscaDeArquivo, pareceConsultaDeVencimentos } from "./gate";
import { caminhoDoArquivo, normalizarTipo } from "./tipos";
import { diasParaVencer, lerValidade, situacaoDaValidade, textoDaValidade } from "./validade";

describe("lerValidade", () => {
  it("le datas comuns", () => {
    expect(lerValidade("14/03/2027")).toEqual({ ok: true, data: "2027-03-14" });
    expect(lerValidade("14-03-27")).toEqual({ ok: true, data: "2027-03-14" });
    expect(lerValidade("2027-03-14")).toEqual({ ok: true, data: "2027-03-14" });
  });
  it("mes/ano vale ate o fim do mes", () => {
    expect(lerValidade("02/2028")).toEqual({ ok: true, data: "2028-02-29" });
    expect(lerValidade("março de 2027")).toEqual({ ok: true, data: "2027-03-31" });
  });
  it("por extenso e sem validade", () => {
    expect(lerValidade("14 de março de 2027")).toEqual({ ok: true, data: "2027-03-14" });
    expect(lerValidade("sem validade")).toEqual({ ok: true, data: null });
  });
  it("rejeita o que nao e data", () => {
    expect(lerValidade("amanhã talvez").ok).toBe(false);
    expect(lerValidade("31/02/2027").ok).toBe(false);
  });
});

describe("situacao da validade", () => {
  it("calcula dias e situacao", () => {
    expect(diasParaVencer("2026-10-20", "2026-10-13")).toBe(7);
    expect(situacaoDaValidade(null, "2026-10-13")).toBe("sem_validade");
    expect(situacaoDaValidade("2026-10-10", "2026-10-13")).toBe("vencido");
    expect(situacaoDaValidade("2026-10-20", "2026-10-13")).toBe("vencendo");
    expect(situacaoDaValidade("2027-03-14", "2026-10-13")).toBe("ok");
    expect(textoDaValidade("2026-10-10", "2026-10-13")).toBe("venceu há 3 dias");
    expect(textoDaValidade("2026-10-13", "2026-10-13")).toBe("vence hoje");
  });
});

describe("gates", () => {
  it("legenda que pede pra guardar", () => {
    expect(legendaPedeGuardar("matrícula do lote 12 do Residencial Aurora")).toBe(true);
    expect(legendaPedeGuardar("guarda esse arquivo")).toBe(true);
    expect(legendaPedeGuardar("boleto da luz")).toBe(false);
    expect(legendaPedeGuardar("nota fiscal do cimento")).toBe(false);
    expect(legendaPedeGuardar("")).toBe(false);
  });
  it("nome do arquivo", () => {
    expect(nomeDoArquivoSugere("matricula_lote12.pdf")).toBe("documento");
    expect(nomeDoArquivoSugere("boleto-luz.pdf")).toBe("conta");
    expect(nomeDoArquivoSugere("IMG_2041.pdf")).toBeNull();
  });
  it("pedido de arquivo", () => {
    expect(pareceBuscaDeArquivo("manda a matrícula do lote 12")).toBe(true);
    expect(pareceBuscaDeArquivo("cadê o alvará do Aurora?")).toBe(true);
    expect(pareceBuscaDeArquivo("preciso do edital da concorrência 04")).toBe(true);
    expect(pareceBuscaDeArquivo("quanto gastei com cimento?")).toBe(false);
    expect(pareceBuscaDeArquivo("manda o boleto da luz")).toBe(false);
  });
  it("consulta de vencimentos", () => {
    expect(pareceConsultaDeVencimentos("quais documentos estão vencendo?")).toBe(true);
    expect(pareceConsultaDeVencimentos("certidões que vencem esse mês")).toBe(true);
    expect(pareceConsultaDeVencimentos("quanto gastei esse mês")).toBe(false);
  });
});

const arquivos: ArquivoBuscavel[] = [
  { id: "1", nome: "Matrícula do lote 12", tipo: "Terreno e matrícula", area: "obra", pastaNome: "Residencial Aurora", descricao: null, nomeArquivo: "matricula_lote12.pdf" },
  { id: "2", nome: "Alvará de construção", tipo: "Licenças", area: "obra", pastaNome: "Residencial Aurora", descricao: null, nomeArquivo: null },
  { id: "3", nome: "Certidão FGTS", tipo: "Certidões", area: "licitacao", pastaNome: "Concorrência 04/2026", descricao: null, nomeArquivo: null },
  { id: "4", nome: "Certidão negativa federal", tipo: "Certidões", area: "empresa", pastaNome: null, descricao: null, nomeArquivo: null },
];

describe("buscarArquivos", () => {
  it("tira as palavras vazias do pedido", () => {
    expect(palavrasDoPedido("manda a matrícula do lote 12")).toEqual(["matricula", "lote", "12"]);
  });
  it("acha o arquivo certo", () => {
    expect(buscarArquivos(arquivos, "manda a matrícula do lote 12").exatos.map((a) => a.id)).toEqual(["1"]);
    expect(buscarArquivos(arquivos, "cadê o alvará do Aurora").exatos.map((a) => a.id)).toEqual(["2"]);
  });
  it("varios candidatos", () => {
    expect(buscarArquivos(arquivos, "manda as certidões").exatos.map((a) => a.id)).toEqual(["3", "4"]);
    expect(buscarArquivos(arquivos, "certidão da licitação").exatos.map((a) => a.id)).toEqual(["3"]);
  });
  it("numero nao casa pedaco de outro numero", () => {
    expect(buscarArquivos(arquivos, "lote 1").exatos).toEqual([]);
  });
  it("sem resultado", () => {
    const r = buscarArquivos(arquivos, "manda o habite-se");
    expect(r.exatos).toEqual([]);
  });
});

describe("lerCorrecao", () => {
  it("campos de pasta", () => {
    expect(lerCorrecao("obra Aurora")).toEqual({ campo: "obra", valor: "Aurora" });
    expect(lerCorrecao("licitação Concorrência 04/2026")).toEqual({ campo: "licitacao", valor: "Concorrência 04/2026" });
    expect(lerCorrecao("empresa")).toEqual({ campo: "empresa", valor: null });
    expect(lerCorrecao("pessoal")).toEqual({ campo: "pessoal", valor: null });
  });
  it("tipo, nome e validade", () => {
    expect(lerCorrecao("tipo licenças")).toEqual({ campo: "tipo", valor: "licenças" });
    expect(lerCorrecao("nome Alvará 2026")).toEqual({ campo: "nome", valor: "Alvará 2026" });
    expect(lerCorrecao("vence 14/03/2027")).toEqual({ campo: "validade", valor: "2027-03-14" });
    expect(lerCorrecao("validade em 03/2027")).toEqual({ campo: "validade", valor: "2027-03-31" });
    expect(lerCorrecao("sem validade")).toEqual({ campo: "validade", valor: null });
  });
  it("excluir e nao entendido", () => {
    expect(lerCorrecao("excluir")).toEqual({ campo: "excluir" });
    expect(lerCorrecao("blablabla")).toBeNull();
    expect(lerCorrecao("vence ontem à noite")).toBeNull();
  });
});

describe("tipos", () => {
  it("normaliza o tipo", () => {
    expect(normalizarTipo("licencas")).toBe("Licenças");
    expect(normalizarTipo("  ")).toBe("Outros");
    expect(normalizarTipo("atas de reunião")).toBe("Atas de reunião");
  });
  it("monta o caminho", () => {
    expect(caminhoDoArquivo({ area: "obra", pastaNome: "Aurora", tipo: "Licenças" })).toBe("Obras › Aurora › Licenças");
    expect(caminhoDoArquivo({ area: "empresa", pastaNome: null, tipo: "Certidões" })).toBe("Empresa › Certidões");
  });
});

import { chaveDaPasta, listarPastas, listarTipos, PASTA_GERAL, PASTA_SEM_OBRA, type ArquivoDePasta } from "./pastas";

const base = { obraNome: null, pasta: null, validade: null, avisar_dias_antes: 30 } as const;

describe("pastas", () => {
  const itens: ArquivoDePasta[] = [
    { ...base, area: "obra", obra_id: "o1", obraNome: "Aurora", tipo: "Licenças", validade: "2026-10-20" },
    { ...base, area: "obra", obra_id: "o1", obraNome: "Aurora", tipo: "Licenças", validade: "2026-10-01" },
    { ...base, area: "obra", obra_id: null, tipo: "Projetos" },
    { ...base, area: "licitacao", obra_id: null, pasta: "Concorrência 04/2026", tipo: "Edital" },
    { ...base, area: "empresa", obra_id: null, tipo: "Certidões" },
  ];
  it("chaves", () => {
    expect(chaveDaPasta(itens[0])).toBe("o1");
    expect(chaveDaPasta(itens[2])).toBe(PASTA_SEM_OBRA);
    expect(chaveDaPasta(itens[4])).toBe(PASTA_GERAL);
    expect(chaveDaPasta(itens[3])).toBe("Concorrência 04/2026");
  });
  it("lista obras (inclusive vazias) com contagem de prazos", () => {
    const pastas = listarPastas(itens.filter((i) => i.area === "obra"), "obra", "2026-10-13", [
      { id: "o1", nome: "Aurora" },
      { id: "o2", nome: "Bela Vista" },
    ]);
    expect(pastas.map((p) => [p.nome, p.total, p.vencidos, p.vencendo])).toEqual([
      ["Aurora", 2, 1, 1],
      ["Bela Vista", 0, 0, 0],
      ["Sem obra definida", 1, 0, 0],
    ]);
  });
  it("licitacoes e tipos", () => {
    expect(listarPastas(itens.filter((i) => i.area === "licitacao"), "licitacao", "2026-10-13")[0].nome).toBe("Concorrência 04/2026");
    expect(listarTipos(itens.filter((i) => i.obra_id === "o1"), "2026-10-13").map((t) => [t.nome, t.total])).toEqual([["Licenças", 2]]);
  });
});

import { chaveDeNome, resolverDestinoDeObra } from "./obraOuProjeto";

describe("resolverDestinoDeObra", () => {
  const obras = [
    { id: "o1", nome: "01 COSTA AMALFITANA" },
    { id: "o2", nome: "Oryon Construtora" },
  ];
  it("chave ignora acento, caixa e letra dobrada", () => {
    expect(chaveDeNome("Villa Borghese")).toBe(chaveDeNome("vila  borghese"));
  });
  it("usa obra cadastrada, mesmo escrita diferente", () => {
    expect(resolverDestinoDeObra("costa amalfitana", obras, [])).toEqual({ tipo: "obra", obraId: "o1", nome: "01 COSTA AMALFITANA" });
  });
  it("reaproveita pasta de projeto parecida", () => {
    expect(resolverDestinoDeObra("Vila Borghese", obras, ["Villa Borghese"])).toEqual({ tipo: "projeto", pasta: "Villa Borghese", nova: false });
  });
  it("cria pasta de projeto nova quando a obra nao existe", () => {
    expect(resolverDestinoDeObra("villa borghese", obras, [])).toEqual({ tipo: "projeto", pasta: "Villa Borghese", nova: true });
  });
  it("avisa quando ha mais de uma obra parecida", () => {
    const r = resolverDestinoDeObra("costa", [...obras, { id: "o3", nome: "02 Costa Amalfitana" }], []);
    expect(r.tipo).toBe("ambiguo");
  });
});

describe("busca no conteudo do arquivo", () => {
  const lista: ArquivoBuscavel[] = [
    {
      id: "m",
      nome: "Matrícula da área remanescente Villa Borghese",
      tipo: "Terreno e matrícula",
      area: "obra",
      pastaNome: "Villa Borghese",
      descricao: null,
      nomeArquivo: "REMANESCENTE_MAT.74912.pdf",
      textoBusca: "Certidão de inteiro teor, matrícula 74.912, Paço do Lumiar, Maranhão, 1º Ofício Extrajudicial, área 228.595,309m²",
    },
    { id: "o", nome: "Alvará Aurora", tipo: "Licenças", area: "obra", pastaNome: "Aurora", descricao: null, nomeArquivo: null, textoBusca: "Prefeitura de São Luís" },
  ];
  it("acha por informacao que so existe dentro do arquivo", () => {
    expect(buscarArquivos(lista, "manda o documento de Paço do Lumiar").exatos.map((a) => a.id)).toEqual(["m"]);
    expect(buscarArquivos(lista, "matrícula 74912").exatos.map((a) => a.id)).toEqual(["m"]);
    expect(buscarArquivos(lista, "matrícula 74.912").exatos.map((a) => a.id)).toEqual(["m"]);
    expect(buscarArquivos(lista, "prefeitura de são luís").exatos.map((a) => a.id)).toEqual(["o"]);
  });
  it("destaca o melhor quando o titulo bate", () => {
    expect(buscarArquivos(lista, "villa borghese").melhor?.id).toBe("m");
  });
});
