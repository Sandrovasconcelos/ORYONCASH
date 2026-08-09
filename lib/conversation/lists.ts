import { sendList } from "@/lib/whatsapp/messages";
import {
  listObrasAtivas,
  listCategorias,
  listEtapasParaObra,
  listFornecedores,
  listDespesasRecentes,
  listMateriais,
  buscarDespesasPorTexto,
} from "./queries";
import { formatBRL } from "./format";
import { CAMPO_IDS } from "./states";

export async function sendListObras(to: string) {
  const obras = await listObrasAtivas();
  await sendList(to, {
    headerText: "🏗️ Seleção de obra",
    bodyText:
      "Toque na obra onde o lançamento deve entrar. Só aparecem as 10 primeiras aqui - se a sua não estiver na lista, digite o nome dela.",
    buttonText: "🏗️ Ver obras",
    sections: [
      { rows: obras.map((o) => ({ id: `obra:${o.id}`, title: o.nome })) },
    ],
  });
}

export async function sendListCategorias(to: string) {
  const categorias = await listCategorias();
  await sendList(to, {
    headerText: "📁 Seleção de categoria",
    bodyText:
      "Escolha o grupo correto para essa despesa. Só aparecem as 10 primeiras aqui - se a sua não estiver na lista, digite o nome dela.",
    buttonText: "📁 Ver categorias",
    sections: [
      {
        rows: categorias.map((c) => ({ id: `categoria:${c.id}`, title: c.nome })),
      },
    ],
  });
}

export async function sendListEtapas(to: string, obraId: string) {
  const etapas = await listEtapasParaObra(obraId);
  await sendList(to, {
    headerText: "📐 Etapa da obra",
    bodyText:
      "Em qual etapa da construção ocorreu essa despesa? Só aparecem as 10 primeiras aqui - se a sua não estiver na lista, digite o nome dela.",
    buttonText: "📐 Ver etapas",
    sections: [
      { rows: etapas.map((e) => ({ id: `etapa:${e.id}`, title: e.nome })) },
    ],
  });
}

export async function sendListFornecedores(to: string) {
  const fornecedores = await listFornecedores();
  await sendList(to, {
    headerText: "🏢 Seleção de fornecedor",
    bodyText:
      "Escolha quem recebeu ou emitiu essa cobrança. Só aparecem os 10 primeiros aqui - se não estiver na lista, digite o nome.",
    buttonText: "🏢 Ver fornecedores",
    sections: [
      {
        rows: fornecedores.map((f) => ({ id: `fornecedor:${f.id}`, title: f.nome })),
      },
    ],
  });
}

export async function sendListMateriais(to: string) {
  const materiais = await listMateriais();
  await sendList(to, {
    headerText: "📦 Seleção de material",
    bodyText:
      "Escolha o material relacionado ao lançamento. Só aparecem os 10 primeiros aqui - se não estiver na lista, digite o nome.",
    buttonText: "📦 Ver materiais",
    sections: [
      {
        rows: materiais.map((m) => ({ id: `material:${m.id}`, title: m.nome })),
      },
    ],
  });
}

export async function sendListMateriaisParaDespesa(to: string) {
  const materiais = (await listMateriais()).slice(0, 9);
  await sendList(to, {
    headerText: "📦 Qual material?",
    bodyText:
      "Escolha um material cadastrado, digite o nome se não estiver nos 9 mostrados, ou toque em '+ Novo Material' para cadastrar.",
    buttonText: "📦 Ver materiais",
    sections: [
      {
        rows: [
          ...materiais.map((m) => ({ id: `material:${m.id}`, title: m.nome })),
          { id: "material:novo", title: "➕ Novo Material" },
        ],
      },
    ],
  });
}

export async function sendListDespesasRecentes(to: string) {
  const despesas = await listDespesasRecentes(10);
  await sendList(to, {
    headerText: "🧾 Últimos lançamentos",
    bodyText:
      "Escolha qual despesa você quer corrigir ou vincular. Só aparecem os 10 mais recentes aqui - se não estiver na lista, digite parte da descrição ou o nome do fornecedor.",
    buttonText: "🧾 Ver lançamentos",
    sections: [
      {
        rows: despesas.map((d) => ({
          id: `despesa:${d.id}`,
          title: `💰 ${formatBRL(d.valor)}`,
          description: `${d.categoriaNome} · ${d.descricao ?? "sem descrição"}`,
        })),
      },
    ],
  });
}

/**
 * Resultado de busca por texto (descricao ou fornecedor) quando o
 * lancamento nao esta entre os 10 mais recentes.
 */
export async function sendListDespesasBusca(to: string, termo: string) {
  const despesas = await buscarDespesasPorTexto(termo, 10);
  await sendList(to, {
    headerText: "🔎 Resultado da busca",
    bodyText: `Encontrei ${despesas.length} lançamento(s) com "${termo}". Toque no certo.`,
    buttonText: "🔎 Ver resultados",
    sections: [
      {
        rows: despesas.map((d) => ({
          id: `despesa:${d.id}`,
          title: `💰 ${formatBRL(d.valor)}`,
          description: `${d.categoriaNome} · ${d.descricao ?? "sem descrição"}`,
        })),
      },
    ],
  });
}

export async function sendListCamposParaCorrigir(to: string) {
  await sendList(to, {
    headerText: "✏️ O que corrigir?",
    bodyText: "Escolha o campo que deseja alterar nessa despesa.",
    buttonText: "✏️ Ver opções",
    sections: [
      {
        rows: [
          { id: CAMPO_IDS.VALOR, title: "💰 Valor" },
          { id: CAMPO_IDS.CATEGORIA, title: "📁 Categoria" },
          { id: CAMPO_IDS.ETAPA, title: "📐 Etapa" },
          { id: CAMPO_IDS.MATERIAL, title: "📦 Material" },
          { id: CAMPO_IDS.FORNECEDOR, title: "🏢 Fornecedor" },
          { id: CAMPO_IDS.DESCRICAO, title: "📝 Descrição" },
          { id: CAMPO_IDS.EXCLUIR, title: "🗑️ Excluir despesa" },
        ],
      },
    ],
  });
}
