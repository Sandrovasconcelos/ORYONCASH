import { sendList } from "@/lib/whatsapp/messages";
import {
  listObrasAtivas,
  listCategorias,
  listEtapasParaObra,
  listFornecedores,
  listDespesasRecentes,
  listMateriais,
} from "./queries";
import { formatBRL } from "./format";
import { CAMPO_IDS } from "./states";

export async function sendListObras(to: string) {
  const obras = await listObrasAtivas();
  await sendList(to, {
    headerText: "🏗️ Seleção de obra",
    bodyText: "Toque na obra onde o lançamento deve entrar.",
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
    bodyText: "Escolha o grupo correto para essa despesa.",
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
    bodyText: "Em qual etapa da construção ocorreu essa despesa?",
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
    bodyText: "Escolha quem recebeu ou emitiu essa cobrança.",
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
    bodyText: "Escolha o material relacionado ao lançamento.",
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
      "Escolha um material cadastrado ou toque em '+ Novo Material' para cadastrar.",
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
    bodyText: "Escolha qual despesa você quer corrigir ou vincular.",
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
