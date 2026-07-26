import { sendList } from "@/lib/whatsapp/messages";
import {
  listObrasAtivas,
  listCategorias,
  listEtapasParaObra,
  listFornecedores,
  listDespesasRecentes,
} from "./queries";
import { formatBRL } from "./format";
import { CAMPO_IDS } from "./states";

export async function sendListObras(to: string) {
  const obras = await listObrasAtivas();
  await sendList(to, {
    headerText: "Seleção de Obra",
    bodyText: "Toque na obra para continuar. Escolha uma opção da lista.",
    buttonText: "Ver Obras",
    sections: [
      { rows: obras.map((o) => ({ id: `obra:${o.id}`, title: o.nome })) },
    ],
  });
}

export async function sendListCategorias(to: string) {
  const categorias = await listCategorias();
  await sendList(to, {
    headerText: "Seleção de Categoria",
    bodyText: "Selecione a categoria da despesa. Toque em uma opção.",
    buttonText: "Ver Categorias",
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
    headerText: "Etapa da Obra",
    bodyText: "Em qual etapa da construção ocorreu esta despesa? Escolha uma opção.",
    buttonText: "Ver Etapas",
    sections: [
      { rows: etapas.map((e) => ({ id: `etapa:${e.id}`, title: e.nome })) },
    ],
  });
}

export async function sendListFornecedores(to: string) {
  const fornecedores = await listFornecedores();
  await sendList(to, {
    headerText: "Seleção de Fornecedor",
    bodyText: "Selecione o fornecedor. Toque em uma opção.",
    buttonText: "Ver Fornecedores",
    sections: [
      {
        rows: fornecedores.map((f) => ({ id: `fornecedor:${f.id}`, title: f.nome })),
      },
    ],
  });
}

export async function sendListDespesasRecentes(to: string) {
  const despesas = await listDespesasRecentes(10);
  await sendList(to, {
    headerText: "Últimos Lançamentos",
    bodyText: "Escolha qual despesa você quer corrigir.",
    buttonText: "Ver Lançamentos",
    sections: [
      {
        rows: despesas.map((d) => ({
          id: `despesa:${d.id}`,
          title: formatBRL(d.valor),
          description: `${d.categoriaNome} • ${d.descricao ?? "sem descrição"}`,
        })),
      },
    ],
  });
}

export async function sendListCamposParaCorrigir(to: string) {
  await sendList(to, {
    headerText: "O que corrigir?",
    bodyText: "Escolha o que deseja alterar nessa despesa.",
    buttonText: "Ver Opções",
    sections: [
      {
        rows: [
          { id: CAMPO_IDS.VALOR, title: "Valor" },
          { id: CAMPO_IDS.CATEGORIA, title: "Categoria" },
          { id: CAMPO_IDS.ETAPA, title: "Etapa" },
          { id: CAMPO_IDS.FORNECEDOR, title: "Fornecedor" },
          { id: CAMPO_IDS.DESCRICAO, title: "Descrição" },
          { id: CAMPO_IDS.EXCLUIR, title: "Excluir despesa" },
        ],
      },
    ],
  });
}
