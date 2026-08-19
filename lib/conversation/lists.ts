import { sendList, sendText } from "@/lib/whatsapp/messages";
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

/**
 * Lista numerada em texto simples - sem limite de 10 itens como as
 * mensagens de lista interativa da API do WhatsApp. A pessoa responde com
 * o número da posição ou digitando o nome (resolverPorNumeroOuNome em
 * queries.ts trata os dois casos, usando a mesma ordem desta lista).
 */
function formatarListaNumerada(itens: { nome: string }[]): string {
  return itens.map((item, indice) => `${indice + 1}. ${item.nome}`).join("\n");
}

export async function sendListObras(to: string) {
  const obras = await listObrasAtivas();
  await sendText(
    to,
    `🏗️ *Selecione a obra*\n\n${formatarListaNumerada(obras)}\n\nResponda com o número ou digite o nome.`
  );
}

export async function sendListCategorias(to: string) {
  const categorias = await listCategorias();
  await sendText(
    to,
    `📁 *Selecione a categoria*\n\n${formatarListaNumerada(categorias)}\n\nResponda com o número ou digite o nome.`
  );
}

export async function sendListEtapas(to: string, obraId: string) {
  const etapas = await listEtapasParaObra(obraId);
  await sendText(
    to,
    `📐 *Em qual etapa da obra?*\n\n${formatarListaNumerada(etapas)}\n\nResponda com o número ou digite o nome.`
  );
}

export async function sendListFornecedores(to: string) {
  const fornecedores = await listFornecedores();
  await sendText(
    to,
    `🏢 *Selecione o fornecedor*\n\n${formatarListaNumerada(fornecedores)}\n\nResponda com o número ou digite o nome.`
  );
}

export async function sendListMateriais(to: string) {
  const materiais = await listMateriais();
  await sendText(
    to,
    `📦 *Selecione o material*\n\n${formatarListaNumerada(materiais)}\n\nResponda com o número ou digite o nome.`
  );
}

export async function sendListMateriaisParaDespesa(to: string) {
  const materiais = await listMateriais();
  await sendText(
    to,
    `📦 *Qual material?*\n\n${formatarListaNumerada(materiais)}\n\nResponda com o número, digite o nome, ou digite *novo* pra cadastrar um material novo.`
  );
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
