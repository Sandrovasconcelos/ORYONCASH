import { sendList } from "@/lib/whatsapp/messages";
import { listObrasAtivas, listCategorias, listEtapasParaObra } from "./queries";

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
