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
  legenda: (dados: DadosRelatorio) => string
): Promise<void> {
  const dados = await buscarDadosRelatorio(filtros);

  if (dados.despesas.length === 0) {
    await sendText(to, mensagemVazio);
    return;
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
 * lib/conversation/perguntaRelatorio.ts.
 */
export async function gerarEEnviarRelatorioPorPergunta(
  to: string,
  filtros: FiltrosRelatorio,
  contexto: string
): Promise<void> {
  await buscarGerarEEnviar(
    to,
    filtros,
    `📭 Não encontrei nenhum lançamento de ${contexto}.`,
    (dados) => `📄 Gastos com ${contexto} — ${formatBRL(dados.totalGasto)} em ${dados.quantidade} lançamento(s)`
  );
}
