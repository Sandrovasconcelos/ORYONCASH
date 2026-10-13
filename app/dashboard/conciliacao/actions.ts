"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, parseValorBR } from "@/lib/conversation/format";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { registrarAtividade } from "@/lib/atividades";
import { getAutorNomeDashboard } from "@/app/dashboard/actions";
import { processarExtrato, reconciliarExtrato } from "@/lib/conciliacao/queries";
import { apagarRegra, aplicarRegrasDeIgnorar, salvarRegra } from "@/lib/conciliacao/regras";
import { avisoPagamentosSemLancamento } from "@/lib/conciliacao/avisos";
import { aceitarVinculoPorValor, buscarVinculosPorValor } from "@/lib/conciliacao/vinculosPorValor";
import { enviarNotificacao, numeroNotificacao } from "@/lib/alertas/notificar";
import { createAdminClient } from "@/lib/supabase/admin";
import { classificacoesDoTipo, ehClassificacao } from "@/lib/caixa/tipos";
import { atualizarStatusDaVenda } from "@/lib/vendas/queries";

const TAMANHO_MAXIMO_ARQUIVO_BYTES = 15 * 1024 * 1024;
const MIME_TYPES_EXTRATO = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function validarArquivoExtrato(arquivo: File) {
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
    throw new Error(
      `Arquivo "${arquivo.name}" tem ${(arquivo.size / (1024 * 1024)).toFixed(1)}MB - o limite é 15MB.`
    );
  }
  if (arquivo.type && !MIME_TYPES_EXTRATO.has(arquivo.type)) {
    throw new Error(`Tipo de arquivo "${arquivo.type || "desconhecido"}" não é aceito para o extrato.`);
  }
}

export async function uploadExtratoAction(formData: FormData) {
  const contaBancariaId = String(formData.get("conta_bancaria_id") ?? "") || null;
  const periodoInicio = String(formData.get("periodo_inicio") ?? "") || null;
  const periodoFim = String(formData.get("periodo_fim") ?? "") || null;
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    console.error("Upload de extrato sem arquivo.");
    return;
  }

  try {
    validarArquivoExtrato(arquivo);
  } catch (error) {
    console.error("Arquivo de extrato inválido:", error);
    return;
  }

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  const extensao =
    arquivo.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() ||
    arquivo.type.split("/")[1]?.replace("jpeg", "jpg") ||
    "bin";
  const storagePath = `extratos/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from("comprovantes")
    .upload(storagePath, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    console.error("Falha ao enviar arquivo de extrato:", uploadError);
    return;
  }

  const { data: extrato, error: insertError } = await supabase
    .from("extratos_bancarios")
    .insert({
      conta_bancaria_id: contaBancariaId,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      storage_bucket: "comprovantes",
      storage_path: storagePath,
      nome_arquivo: arquivo.name,
      created_by: autorNome,
    })
    .select("id")
    .single();
  if (insertError || !extrato) {
    console.error("Falha ao registrar extrato:", insertError);
    return;
  }

  try {
    await processarExtrato(extrato.id);
  } catch (error) {
    console.error("Falha ao processar extrato bancário:", error);
  }

  // Avisa no Telegram o que ficou sem lancamento (best effort).
  try {
    const [numero, aviso] = await Promise.all([numeroNotificacao(), avisoPagamentosSemLancamento()]);
    if (numero && aviso) await enviarNotificacao(numero, aviso.mensagem, { botoes: aviso.botoes });
  } catch (error) {
    console.error("Falha ao avisar pendencias do extrato:", error);
  }

  await registrarAtividade({
    tipo: "criacao",
    entidade: "extrato_bancario",
    entidadeId: extrato.id,
    origem: "dashboard",
    autorNome,
    resumo: `Extrato bancário enviado por ${autorNome} para conciliação`,
  });

  revalidatePath("/dashboard/conciliacao");
  redirect(`/dashboard/conciliacao/${extrato.id}`);
}

export async function reconciliarExtratoAction(formData: FormData) {
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!extratoId) return;
  await reconciliarExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
  revalidatePath("/dashboard/conciliacao");
}

export async function excluirExtratoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: extrato } = await supabase
    .from("extratos_bancarios")
    .select("storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("extrato_transacoes").delete().eq("extrato_id", id);
  await supabase.from("extratos_bancarios").delete().eq("id", id);

  if (extrato) {
    await supabase.storage.from(extrato.storage_bucket).remove([extrato.storage_path]);
  }

  const autorNome = await getAutorNomeDashboard();
  await registrarAtividade({
    tipo: "exclusao",
    entidade: "extrato_bancario",
    entidadeId: id,
    origem: "dashboard",
    autorNome,
    resumo: `Extrato bancário excluído por ${autorNome}`,
  });

  revalidatePath("/dashboard/conciliacao");
}

export async function vincularTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const despesaId = String(formData.get("despesa_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!transacaoId || !despesaId) return;

  const supabase = await createClient();
  await supabase
    .from("extrato_transacoes")
    .update({ despesa_id: despesaId, status: "conciliado" })
    .eq("id", transacaoId);

  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
}

export async function desvincularTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!transacaoId) return;

  const supabase = await createClient();
  // Entrada ligada a uma parcela: a parcela volta a ficar em aberto (ou some, se foi criada so pra este pagamento).
  const { data: antes } = await supabase.from("extrato_transacoes").select("parcela_id").eq("id", transacaoId).maybeSingle();
  if (antes?.parcela_id) {
    const { data: parcela } = await supabase.from("parcelas_venda").select("id, venda_id, tipo").eq("id", antes.parcela_id).maybeSingle();
    if (parcela?.tipo === "outra") {
      await supabase.from("parcelas_venda").delete().eq("id", parcela.id);
    } else if (parcela) {
      await supabase
        .from("parcelas_venda")
        .update({ status: "a_receber", recebido_em: null, valor_recebido: null, conta_bancaria_id: null })
        .eq("id", parcela.id);
    }
    if (parcela) await atualizarStatusDaVenda(parcela.venda_id);
  }

  await supabase
    .from("extrato_transacoes")
    .update({ despesa_id: null, status: "pendente", classificacao: null, parcela_id: null, observacao: null })
    .eq("id", transacaoId);

  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
  revalidatePath("/dashboard/vendas");
}

/**
 * Classifica uma transacao do extrato que ainda nao tinha destino: entrada de
 * venda (ligando a uma parcela, a um pagamento avulso de uma venda ou criando
 * a venda na hora), aporte, rendimento, resgate, aplicacao ou outras.
 */
export async function classificarTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  const classificacao = String(formData.get("classificacao") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim().slice(0, 300) || null;
  if (!transacaoId || !ehClassificacao(classificacao)) return;

  const supabase = await createClient();
  const { data: t } = await supabase
    .from("extrato_transacoes")
    .select("id, data, valor, tipo, extratos_bancarios(conta_bancaria_id)")
    .eq("id", transacaoId)
    .maybeSingle();
  if (!t) return;
  const direcaoOk = classificacoesDoTipo(t.tipo).some((c) => c.id === classificacao);
  if (!direcaoOk) return;
  const contaId = (t as { extratos_bancarios?: { conta_bancaria_id: string | null } | null }).extratos_bancarios?.conta_bancaria_id ?? null;

  let parcelaId: string | null = null;
  let vendaAfetada: string | null = null;

  if (classificacao === "venda") {
    const modo = String(formData.get("modo") ?? "parcela");
    const recebimento = { status: "recebida" as const, recebido_em: t.data, valor_recebido: t.valor, conta_bancaria_id: contaId };

    if (modo === "parcela") {
      const id = String(formData.get("parcela_id") ?? "");
      if (!id) return;
      // Aceita parcela em aberto ou ja marcada como recebida na mao (desde que nenhum extrato a use).
      const { count: jaUsada } = await supabase.from("extrato_transacoes").select("id", { count: "exact", head: true }).eq("parcela_id", id);
      if ((jaUsada ?? 0) > 0) return;
      const { data: parcela, error } = await supabase.from("parcelas_venda").update(recebimento).eq("id", id).in("status", ["a_receber", "recebida"]).select("id, venda_id").maybeSingle();
      if (error || !parcela) return;
      parcelaId = parcela.id;
      vendaAfetada = parcela.venda_id;
    } else {
      let vendaId = String(formData.get("venda_id") ?? "");
      if (modo === "nova_venda") {
        const cliente = String(formData.get("novo_cliente") ?? "").trim();
        const valorTotal = parseValorBR(String(formData.get("novo_valor_total") ?? "0")) ?? 0;
        if (!cliente || valorTotal <= 0) return;
        const { data: nova, error } = await supabase
          .from("vendas")
          .insert({
            cliente_nome: cliente.slice(0, 120),
            unidade: String(formData.get("nova_unidade") ?? "").trim().slice(0, 80) || null,
            obra_id: String(formData.get("nova_obra_id") ?? "") || null,
            valor_total: valorTotal,
            data_contrato: t.data,
            created_by: await getAutorNomeDashboard(),
          })
          .select("id")
          .single();
        if (error || !nova) return;
        vendaId = nova.id;
      }
      if (!vendaId) return;
      const { data: ultima } = await supabase.from("parcelas_venda").select("numero").eq("venda_id", vendaId).order("numero", { ascending: false }).limit(1);
      const { data: avulsa, error } = await supabase
        .from("parcelas_venda")
        .insert({ venda_id: vendaId, numero: (ultima?.[0]?.numero ?? 0) + 1, tipo: "outra", vencimento: t.data, valor: t.valor, ...recebimento })
        .select("id")
        .single();
      if (error || !avulsa) return;
      parcelaId = avulsa.id;
      vendaAfetada = vendaId;
    }
  }

  await supabase
    .from("extrato_transacoes")
    .update({ classificacao, status: "conciliado", parcela_id: parcelaId, observacao, despesa_id: null })
    .eq("id", transacaoId);

  if (vendaAfetada) await atualizarStatusDaVenda(vendaAfetada);
  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
  revalidatePath("/dashboard/conciliacao");
  revalidatePath("/dashboard/vendas");
}

export async function ignorarTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!transacaoId) return;

  // "Sempre ignorar pagamentos como este": vira regra e vale ja pros demais pendentes.
  if (formData.get("lembrar") === "on") {
    const { data: t } = await createAdminClient()
      .from("extrato_transacoes")
      .select("descricao")
      .eq("id", transacaoId)
      .maybeSingle();
    if (t && (await salvarRegra({ descricao: t.descricao, acao: "ignorar" }))) {
      await aplicarRegrasDeIgnorar(extratoId);
    }
  }

  const supabase = await createClient();
  await supabase
    .from("extrato_transacoes")
    .update({ status: "ignorado", despesa_id: null })
    .eq("id", transacaoId);

  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
}

export async function criarDespesaDaTransacaoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  const contaBancariaId = String(formData.get("conta_bancaria_id") ?? "") || null;
  const obraId = String(formData.get("obra_id") ?? "");
  const categoriaId = String(formData.get("categoria_id") ?? "");
  const fornecedorId = String(formData.get("fornecedor_id") ?? "") || null;
  const valor = parseValorBR(String(formData.get("valor") ?? "0")) ?? 0;
  const data = String(formData.get("data") ?? "") || hojeNoBrasil();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;

  if (!transacaoId || !obraId || !categoriaId || valor <= 0) return;

  const supabase = await createClient();
  const autorNome = await getAutorNomeDashboard();

  const depois = {
    obra_id: obraId,
    categoria_id: categoriaId,
    conta_bancaria_id: contaBancariaId,
    fornecedor_id: fornecedorId,
    valor,
    data,
    descricao,
    origem: "dashboard" as const,
  };

  const { data: despesa, error } = await supabase.from("despesas").insert(depois).select("id").single();
  if (error || !despesa) return;

  await registrarAtividade({
    tipo: "criacao",
    entidade: "despesa",
    entidadeId: despesa.id,
    origem: "dashboard",
    autorNome,
    resumo: `Despesa de ${formatBRL(valor)} lançada por ${autorNome} a partir da conciliação bancária`,
    dadosDepois: depois,
  });

  const { data: transacaoOrigem } = await supabase
    .from("extrato_transacoes")
    .update({ despesa_id: despesa.id, status: "conciliado" })
    .eq("id", transacaoId)
    .select("descricao")
    .maybeSingle();

  // Aprende: da proxima vez que o extrato tiver pagamento pra esse beneficiario,
  // a obra e a categoria ja vem preenchidas.
  await salvarRegra({
    descricao: transacaoOrigem?.descricao ?? null,
    acao: "lancar",
    obraId,
    categoriaId,
    fornecedorId,
  });

  await atualizarTotaisExtrato(extratoId);
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
  revalidatePath("/dashboard/despesas");
}

export async function aceitarVinculoAction(formData: FormData) {
  const transacaoId = String(formData.get("transacao_id") ?? "");
  const despesaId = String(formData.get("despesa_id") ?? "");
  const extratoId = String(formData.get("extrato_id") ?? "");
  const ajustarData = formData.get("ajustar_data") === "sim";
  if (!transacaoId || !despesaId) return;

  const autorNome = await getAutorNomeDashboard();
  await aceitarVinculoPorValor({ transacaoId, despesaId, ajustarData, autorNome, origem: "dashboard" });
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
  revalidatePath("/dashboard/despesas");
}

/** Aceita de uma vez todas as sugestoes (mesmo valor, data diferente) do extrato, acertando as datas. */
export async function aceitarTodasSugestoesAction(formData: FormData) {
  const extratoId = String(formData.get("extrato_id") ?? "");
  if (!extratoId) return;

  const { data: pendentes } = await createAdminClient()
    .from("extrato_transacoes")
    .select("id, data, valor")
    .eq("extrato_id", extratoId)
    .eq("status", "pendente")
    .eq("tipo", "debito");
  const sugestoes = await buscarVinculosPorValor(pendentes ?? []);
  const autorNome = await getAutorNomeDashboard();
  for (const s of sugestoes.values()) {
    await aceitarVinculoPorValor({ transacaoId: s.transacaoId, despesaId: s.despesaId, ajustarData: true, autorNome, origem: "dashboard" });
  }
  revalidatePath(`/dashboard/conciliacao/${extratoId}`);
  revalidatePath("/dashboard/despesas");
}

export async function apagarRegraAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await apagarRegra(id);
  revalidatePath("/dashboard/conciliacao");
}

export async function atualizarRegraAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const acao = String(formData.get("acao") ?? "");
  if (!id || (acao !== "ignorar" && acao !== "lancar")) return;
  await createAdminClient()
    .from("conciliacao_regras")
    .update({
      acao,
      obra_id: acao === "lancar" ? String(formData.get("obra_id") ?? "") || null : null,
      categoria_id: acao === "lancar" ? String(formData.get("categoria_id") ?? "") || null : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/dashboard/conciliacao");
}

async function atualizarTotaisExtrato(extratoId: string) {
  if (!extratoId) return;
  const supabase = await createClient();
  const { count: total } = await supabase
    .from("extrato_transacoes")
    .select("id", { count: "exact", head: true })
    .eq("extrato_id", extratoId);
  const { count: conciliadas } = await supabase
    .from("extrato_transacoes")
    .select("id", { count: "exact", head: true })
    .eq("extrato_id", extratoId)
    .eq("status", "conciliado");

  await supabase
    .from("extratos_bancarios")
    .update({ total_transacoes: total ?? 0, total_conciliadas: conciliadas ?? 0 })
    .eq("id", extratoId);
}
