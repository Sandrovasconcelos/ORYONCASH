import { createAdminClient } from "@/lib/supabase/admin";
import { extractBankStatement } from "@/lib/gemini/extractBankStatement";
import { casarTransacoes } from "@/lib/conciliacao/matching";

const JANELA_BUSCA_DESPESA_DIAS = 3;

function subtrairDias(dataISO: string, dias: number): string {
  const data = new Date(`${dataISO}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

function somarDias(dataISO: string, dias: number): string {
  const data = new Date(`${dataISO}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/**
 * Baixa o arquivo do extrato ja enviado pro Storage, extrai as transacoes
 * via Gemini, grava tudo e tenta casar automaticamente com despesas
 * existentes da mesma conta. Roda de forma sincrona dentro da server action
 * de upload (pode levar dezenas de segundos com um extrato grande de
 * varias paginas).
 */
export async function processarExtrato(extratoId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: extrato, error: erroExtrato } = await supabase
    .from("extratos_bancarios")
    .select("*")
    .eq("id", extratoId)
    .single();

  if (erroExtrato || !extrato) return;

  try {
    const { data: arquivo, error: erroDownload } = await supabase.storage
      .from(extrato.storage_bucket)
      .download(extrato.storage_path);
    if (erroDownload || !arquivo) throw erroDownload ?? new Error("Arquivo não encontrado no Storage.");

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const transacoesExtraidas = await extractBankStatement(buffer, arquivo.type || "application/pdf");

    if (transacoesExtraidas.length === 0) {
      await supabase
        .from("extratos_bancarios")
        .update({ status: "erro", erro: "Não foi possível identificar nenhuma transação no arquivo." })
        .eq("id", extratoId);
      return;
    }

    const { data: transacoesInseridas, error: erroInsert } = await supabase
      .from("extrato_transacoes")
      .insert(
        transacoesExtraidas.map((t) => ({
          extrato_id: extratoId,
          data: t.data,
          descricao: t.descricao,
          valor: t.valor,
          tipo: t.tipo,
          status: t.tipo === "credito" ? ("ignorado" as const) : ("pendente" as const),
        }))
      )
      .select("id, data, valor, tipo");

    if (erroInsert || !transacoesInseridas) throw erroInsert ?? new Error("Falha ao gravar transações.");

    const datas = transacoesExtraidas.map((t) => t.data).sort();
    const periodoInicio = datas[0];
    const periodoFim = datas[datas.length - 1];

    const totalConciliadas = extrato.conta_bancaria_id
      ? await conciliarAutomaticamente({
          contaBancariaId: extrato.conta_bancaria_id,
          periodoInicio,
          periodoFim,
          transacoes: transacoesInseridas,
        })
      : 0;

    await supabase
      .from("extratos_bancarios")
      .update({
        status: "concluido",
        periodo_inicio: extrato.periodo_inicio ?? periodoInicio,
        periodo_fim: extrato.periodo_fim ?? periodoFim,
        total_transacoes: transacoesInseridas.length,
        total_conciliadas: totalConciliadas,
      })
      .eq("id", extratoId);
  } catch (error) {
    await supabase
      .from("extratos_bancarios")
      .update({
        status: "erro",
        erro: error instanceof Error ? error.message : "Erro desconhecido ao processar o extrato.",
      })
      .eq("id", extratoId);
    throw error;
  }
}

async function conciliarAutomaticamente(input: {
  contaBancariaId: string;
  periodoInicio: string;
  periodoFim: string;
  transacoes: { id: string; data: string; valor: number; tipo: "debito" | "credito" }[];
}): Promise<number> {
  const supabase = createAdminClient();

  const { data: despesasCandidatas } = await supabase
    .from("despesas")
    .select("id, data, valor")
    .eq("conta_bancaria_id", input.contaBancariaId)
    .is("deleted_at", null)
    .gte("data", subtrairDias(input.periodoInicio, JANELA_BUSCA_DESPESA_DIAS))
    .lte("data", somarDias(input.periodoFim, JANELA_BUSCA_DESPESA_DIAS));

  const { data: jaVinculadas } = await supabase
    .from("extrato_transacoes")
    .select("despesa_id")
    .not("despesa_id", "is", null);
  const idsJaVinculados = new Set((jaVinculadas ?? []).map((v) => v.despesa_id));

  const despesasDisponiveis = (despesasCandidatas ?? []).filter((d) => !idsJaVinculados.has(d.id));

  const casamentos = casarTransacoes(input.transacoes, despesasDisponiveis);
  if (casamentos.size === 0) return 0;

  for (const [transacaoId, despesaId] of casamentos) {
    await supabase
      .from("extrato_transacoes")
      .update({ despesa_id: despesaId, status: "conciliado" })
      .eq("id", transacaoId);
  }

  return casamentos.size;
}
