import { createAdminClient } from "@/lib/supabase/admin";
import { extractBankStatement } from "@/lib/gemini/extractBankStatement";
import { casarTransacoes } from "@/lib/conciliacao/matching";
import { ehMovimentoFinanceiro } from "@/lib/conciliacao/classificar";
import { aplicarRegrasDeIgnorar } from "@/lib/conciliacao/regras";

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
 * Extratos de periodos que se sobrepoem (ex: parcial do dia 27 e o mes inteiro)
 * duplicariam as mesmas transacoes. Compara por data + valor + tipo (a
 * descricao muda de um formato de extrato pra outro) contando repeticoes:
 * se o extrato anterior ja tem 6 PIX de R$ 3.690 no dia, so entram os que
 * passarem de 6.
 */
async function descartarJaImportadas<T extends { data: string; valor: number; tipo: string }>(
  contaBancariaId: string | null,
  extratoIdAtual: string,
  transacoes: T[]
): Promise<T[]> {
  if (!contaBancariaId || transacoes.length === 0) return transacoes;
  const supabase = createAdminClient();
  const datas = transacoes.map((t) => t.data).sort();
  const { data: existentes } = await supabase
    .from("extrato_transacoes")
    .select("data, valor, tipo, extratos_bancarios!inner(conta_bancaria_id)")
    .eq("extratos_bancarios.conta_bancaria_id", contaBancariaId)
    .neq("extrato_id", extratoIdAtual)
    .gte("data", datas[0])
    .lte("data", datas[datas.length - 1])
    .limit(5000);
  if (!existentes || existentes.length === 0) return transacoes;

  const chave = (t: { data: string; valor: number; tipo: string }) => `${t.data}|${Math.round(t.valor * 100)}|${t.tipo}`;
  const jaTem = new Map<string, number>();
  for (const e of existentes) jaTem.set(chave(e), (jaTem.get(chave(e)) ?? 0) + 1);

  return transacoes.filter((t) => {
    const k = chave(t);
    const restante = jaTem.get(k) ?? 0;
    if (restante > 0) {
      jaTem.set(k, restante - 1);
      return false;
    }
    return true;
  });
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
    const lidas = await extractBankStatement(buffer, arquivo.type || "application/pdf");
    // Linhas de saldo/total podem escapar com valor zero.
    const validas = lidas.filter((t) => t.valor > 0);
    const transacoesExtraidas = await descartarJaImportadas(extrato.conta_bancaria_id, extratoId, validas);

    if (transacoesExtraidas.length === 0) {
      await supabase
        .from("extratos_bancarios")
        .update({
          status: "erro",
          erro:
            validas.length > 0
              ? "Todas as transações desse arquivo já estavam em outro extrato desta conta (períodos repetidos)."
              : "Não foi possível identificar nenhuma transação no arquivo.",
        })
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
          // Credito e aplicacao/resgate nao sao despesa de obra.
          status:
            t.tipo === "credito" || ehMovimentoFinanceiro(t.descricao)
              ? ("ignorado" as const)
              : ("pendente" as const),
        }))
      )
      .select("id, data, valor, tipo");

    if (erroInsert || !transacoesInseridas) throw erroInsert ?? new Error("Falha ao gravar transações.");

    // Regras aprendidas (ex: "sempre ignorar transferencia pra mim mesmo").
    await aplicarRegrasDeIgnorar(extratoId);

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

/**
 * Roda o casamento de novo so nas transacoes que continuam sem lancamento.
 * Serve porque o lancamento costuma ser feito DEPOIS de o extrato ser enviado
 * (o extrato de agosto so era conciliado no upload e nunca mais).
 */
export async function reconciliarExtrato(extratoId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data: extrato } = await supabase
    .from("extratos_bancarios")
    .select("conta_bancaria_id")
    .eq("id", extratoId)
    .maybeSingle();
  if (!extrato?.conta_bancaria_id) return 0;

  await aplicarRegrasDeIgnorar(extratoId);

  const { data: pendentes } = await supabase
    .from("extrato_transacoes")
    .select("id, data, valor, tipo")
    .eq("extrato_id", extratoId)
    .eq("status", "pendente")
    .eq("tipo", "debito");
  if (!pendentes || pendentes.length === 0) return 0;

  const datas = pendentes.map((t) => t.data).sort();
  const novas = await conciliarAutomaticamente({
    contaBancariaId: extrato.conta_bancaria_id,
    periodoInicio: datas[0],
    periodoFim: datas[datas.length - 1],
    transacoes: pendentes,
  });

  if (novas > 0) {
    const { count } = await supabase
      .from("extrato_transacoes")
      .select("id", { count: "exact", head: true })
      .eq("extrato_id", extratoId)
      .eq("status", "conciliado");
    await supabase.from("extratos_bancarios").update({ total_conciliadas: count ?? 0 }).eq("id", extratoId);
  }
  return novas;
}

/** Reconcilia todos os extratos concluidos (usado pelo lembrete diario). */
export async function reconciliarTodosOsExtratos(): Promise<number> {
  const { data } = await createAdminClient().from("extratos_bancarios").select("id").eq("status", "concluido");
  let total = 0;
  for (const e of data ?? []) total += await reconciliarExtrato(e.id).catch(() => 0);
  return total;
}

async function conciliarAutomaticamente(input: {
  contaBancariaId: string;
  periodoInicio: string;
  periodoFim: string;
  transacoes: { id: string; data: string; valor: number; tipo: "debito" | "credito" }[];
}): Promise<number> {
  const supabase = createAdminClient();

  // Inclui despesas sem conta bancaria definida - a maioria dos
  // lancamentos (WhatsApp, e boa parte do dashboard) nunca preenche esse
  // campo, entao exigir a mesma conta do extrato deixava o casamento
  // automatico praticamente sempre vazio.
  const { data: despesasCandidatas } = await supabase
    .from("despesas")
    .select("id, data, valor")
    .or(`conta_bancaria_id.eq.${input.contaBancariaId},conta_bancaria_id.is.null`)
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

/** Transacao de debito ainda sem lancamento (null se ja foi resolvida ou nao existe). */
export async function buscarTransacaoPendente(id: string) {
  const { data } = await createAdminClient()
    .from("extrato_transacoes")
    .select("id, extrato_id, data, descricao, valor, tipo, status")
    .eq("id", id)
    .maybeSingle();
  return data && data.status === "pendente" && data.tipo === "debito" ? data : null;
}

/** Liga a transacao ao lancamento e atualiza os totais do extrato. */
export async function vincularTransacaoADespesa(transacaoId: string, despesaId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: transacao } = await supabase
    .from("extrato_transacoes")
    .update({ despesa_id: despesaId, status: "conciliado" })
    .eq("id", transacaoId)
    .select("extrato_id")
    .maybeSingle();
  if (transacao) await atualizarTotaisDoExtrato(transacao.extrato_id);
}

/** Descarta a transacao (nao e despesa de obra). */
export async function ignorarTransacao(transacaoId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: transacao } = await supabase
    .from("extrato_transacoes")
    .update({ status: "ignorado", despesa_id: null })
    .eq("id", transacaoId)
    .select("extrato_id")
    .maybeSingle();
  if (transacao) await atualizarTotaisDoExtrato(transacao.extrato_id);
}

async function atualizarTotaisDoExtrato(extratoId: string): Promise<void> {
  const supabase = createAdminClient();
  const [{ count: total }, { count: conciliadas }] = await Promise.all([
    supabase.from("extrato_transacoes").select("id", { count: "exact", head: true }).eq("extrato_id", extratoId),
    supabase
      .from("extrato_transacoes")
      .select("id", { count: "exact", head: true })
      .eq("extrato_id", extratoId)
      .eq("status", "conciliado"),
  ]);
  await supabase
    .from("extratos_bancarios")
    .update({ total_transacoes: total ?? 0, total_conciliadas: conciliadas ?? 0 })
    .eq("id", extratoId);
}
