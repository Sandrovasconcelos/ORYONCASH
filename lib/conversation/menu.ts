import { sendList } from "@/lib/whatsapp/messages";
import { MENU_IDS } from "./states";

export async function sendMenuPrincipal(to: string) {
  await sendList(to, {
    headerText: "Menu Principal",
    bodyText: "O que você quer fazer?",
    buttonText: "Ver Opções",
    sections: [
      {
        rows: [
          {
            id: MENU_IDS.REGISTRAR_DESPESA,
            title: "Registrar Despesa",
            description: "Lançar uma nova compra ou gasto",
          },
          {
            id: MENU_IDS.CADASTRAR_OBRA,
            title: "Cadastrar Obra",
            description: "Adicionar um novo projeto",
          },
          {
            id: MENU_IDS.CADASTRAR_MATERIAL,
            title: "Cadastrar Material",
            description: "Adicionar um material ao catálogo",
          },
          {
            id: MENU_IDS.CADASTRAR_FORNECEDOR,
            title: "Cadastrar Fornecedor",
            description: "Adicionar um fornecedor",
          },
          {
            id: MENU_IDS.VER_RESUMO,
            title: "Ver Resumo",
            description: "Orçamento x gasto de uma obra",
          },
          {
            id: MENU_IDS.CORRIGIR_LANCAMENTO,
            title: "Corrigir Lançamento",
            description: "Editar ou excluir uma despesa registrada",
          },
          {
            id: MENU_IDS.REMOVER_CADASTRO,
            title: "Remover Cadastro",
            description: "Excluir uma obra, material ou fornecedor",
          },
        ],
      },
    ],
  });
}
