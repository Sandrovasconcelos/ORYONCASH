import { createAdminClient } from "@/lib/supabase/admin";
import { buscarDadosRelatorio, type FiltrosRelatorio, type DadosRelatorio } from "@/lib/relatorio/dados";
import { gerarRelatorioPdfBuffer } from "@/lib/relatorio/pdf";
import { sendDocument, sendList, sendText } from "@/lib/whatsapp/messages";
import { formatDataHoraBrasil } from "@/lib/format-date";
import { formatBRL } from "./format";
import { hojeNoBrasil } from "./queries";
import { PERIODO_RELATORIO_IDS } from "./states";

export async function sendListPeriodoRelatorio(to: string) {
  await sendList(to, {
    headerText: "📅 Período do relatório",
    bodyText: "De qual período?",
    buttonText: "📅 Ver opções",
    sections: [
      {
        rows: [
          { id: PERIODO_RELATORIO_IDS.MES_ATUAL, title: "Este mês" },
          { id: PERIODO_RELATORIO_IDS.MES_PASSADO, title: "Mês passado" },
          { id: PERIODO_RELATORIO_IDS.ANO_ATUAL, title: "Este ano" },
          { id: PERIODO_RELATORIO_IDS.TUDO, title: "Tudo" },
        ],
      },
    ],
  });
}

function calcularPeriodo(chave: string): { dataInicio?: string; dataFim?: string } {
  const hoje = hojeNoBrasil();
  const [ano, mes] = hoje.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (chave === PERIODO_RELATORIO_IDS.MES_ATUAL) {
    return { dataInicio: `${ano}-${pad(mes)}-01`, dataFim: hoje };
  }
  if (chave === PERIODO_RELATORIO_IDS.MES_PASSADO) {
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anoDoMesAnterior = mes === 1 ? ano - 1 : ano;
    const ultimoDia = new Date(Date.UTC(anoDoMesAnterior, mesAnterior, 0)).getUTCDate();
    return {
      dataInicio: `${anoDoMesAnterior}-${pad(mesAnterior)}-01`,
      dataFim: `${anoDoMesAnterior}-${pad(mesAnterior)}-${pad(ultimoDia)}`,
    };
  }
  if (chave === PERIODO_RELATORIO_IDS.ANO_ATUAL) {
    return { dataInicio: `${ano}-01-01`, dataFim: hoje };
  }
  return {};
}

/**
 * Busca os dados, gera o PDF e manda pra quem pediu, pelo proprio WhatsApp -
 * mesma logica de app/dashboard/actions.ts (enviarRelatorioPdfWhatsAppAction),
 * so que o destinatario e quem esta conversando, nao o numero fixo de
 * notificacoes configurado no dashboard. Usada tanto pelo fluxo de menu
 * (gerarEEnviarRelatorio) quanto pela pergunta livre
 * (gerarEEnviarRelatorioPorPergunta).
 */
async function buscarGerarEEnviar(
  to: string,
  filtros: FiltrosRelatorio,
  mensagemVazio: string,
  legenda: (dados: DadosRelatorio) => string,
  resumoTexto?: (dados: DadosRelatorio) => string
): Promise<void> {
  const dados = await buscarDadosRelatorio(filtros);

  if (dados.despesas.length === 0) {
    await sendText(to, mensagemVazio);
    return;
  }

  if (resumoTexto) {
    await sendText(to, resumoTexto(dados));
  }

  const geradoEm = formatDataHoraBrasil(new Date().toISOString());
  const buffer = await gerarRelatorioPdfBuffer(dados, geradoEm);

  const supabase = createAdminClient();
  const storagePath = `relatorios/${Date.now()}-${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("comprovantes")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    await sendText(to, "⚠️ Não consegui gerar o relatório agora. Tente de novo em instantes.");
    return;
  }

  const { data: signed } = await supabase.storage
    .from("comprovantes")
    .createSignedUrl(storagePath, 60 * 60 * 24);
  if (!signed?.signedUrl) {
    await sendText(to, "⚠️ Não consegui gerar o link do relatório.");
    return;
  }

  await sendDocument(to, signed.signedUrl, "relatorio-oryoncash.pdf", legenda(dados));
}

export async function gerarEEnviarRelatorio(
  to: string,
  obraId: string | null,
  periodoChave: string
): Promise<void> {
  const { dataInicio, dataFim } = calcularPeriodo(periodoChave);
  await buscarGerarEEnviar(
    to,
    { obra: obraId ?? undefined, dataInicio, dataFim },
    "📭 Nenhum lançamento encontrado para esse filtro.",
    (dados) => `📄 Relatório de despesas — ${formatBRL(dados.totalGasto)} em ${dados.quantidade} lançamento(s)`
  );
}

/**
 * Relatorio filtrado a partir de uma pergunta livre ("quanto gastei com
 * cimento?") ja interpretada e casada com um cadastro - ver
 * lib/conversation/perguntaRelatorio.ts. Quando "ranking" vem preenchido
 * (pergunta tipo "qual fornecedor mais gastou"), o resumo em texto mostra o
 * top 5 antes do PDF (que sai filtrado so pro primeiro colocado).
 */
export async function gerarEEnviarRelatorioPorPergunta(
  to: string,
  filtros: FiltrosRelatorio,
  contexto: string,
  ranking?: { nome: string; total: number }[]
): Promise<void> {
  await buscarGerarEEnviar(
    to,
    filtros,
    `📭 Não encontrei nenhum lançamento de ${contexto}.`,
    () => `📄 Relatório detalhado de ${contexto} em anexo.`,
    (dados) => {
      let texto = `📊 *${ranking ? `Maior gasto: ${contexto}` : contexto}*\n${formatBRL(dados.totalGasto)} em ${dados.quantidade} lançamento(s)`;
      if (dados.periodo !== "-") texto += ` · período ${dados.periodo}`;
      if (ranking && ranking.length > 1) {
        texto += `\n\n🏆 Ranking:\n${ranking
          .slice(0, 5)
          .map((item, indice) => `${indice + 1}. ${item.nome} — ${formatBRL(item.total)}`)
          .join("\n")}`;
      }
      return texto;
    }
  );
}
