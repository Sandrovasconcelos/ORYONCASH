import { sendList } from "@/lib/whatsapp/messages";
import { MENU_IDS } from "./states";

export async function sendMenuPrincipal(to: string) {
  await sendList(to, {
    headerText: "🏠 Menu Principal",
    bodyText: "O que você quer fazer agora?",
    buttonText: "📋 Ver opções",
    sections: [
      {
        rows: [
          {
            id: MENU_IDS.REGISTRAR_DESPESA,
            title: "💸 Registrar despesa",
            description: "Enviar nota, comprovante, texto ou áudio",
          },
          {
            id: MENU_IDS.CADASTRAR_OBRA,
            title: "🏗️ Cadastrar obra",
            description: "Adicionar um novo projeto",
          },
          {
            id: MENU_IDS.CADASTRAR_MATERIAL,
            title: "📦 Cadastrar material",
            description: "Adicionar item ao catálogo",
          },
          {
            id: MENU_IDS.CADASTRAR_FORNECEDOR,
            title: "🏢 Cadastrar fornecedor",
            description: "Adicionar loja, prestador ou empresa",
          },
          {
            id: MENU_IDS.VER_RESUMO,
            title: "📊 Ver resumo",
            description: "Orçamento x gasto de uma obra",
          },
          {
            id: MENU_IDS.CORRIGIR_LANCAMENTO,
            title: "✏️ Corrigir lançamento",
            description: "Editar ou excluir uma despesa",
          },
          {
            id: MENU_IDS.REMOVER_CADASTRO,
            title: "🗑️ Remover cadastro",
            description: "Enviar obra, material ou fornecedor para remoção",
          },
        ],
      },
    ],
  });
}
