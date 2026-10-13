"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseValorBR } from "@/lib/conversation/format";
import { getAutorNomeDashboard } from "@/app/dashboard/actions";
import { gerarParcelas } from "@/lib/vendas/parcelas";
import { atualizarStatusDaVenda } from "@/lib/vendas/queries";

const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function atualizarTelas() {
  revalidatePath("/dashboard/vendas");
  revalidatePath("/dashboard/conciliacao");
  revalidatePath("/dashboard/fechamento");
}

/** Cadastra a venda e gera as parcelas (entrada + N mensais); opcionalmente marca as primeiras como ja pagas. */
export async function criarVendaAction(formData: FormData) {
  const cliente = String(formData.get("cliente_nome") ?? "").trim().slice(0, 120);
  const valorTotal = parseValorBR(String(formData.get("valor_total") ?? "0")) ?? 0;
  if (!cliente || valorTotal <= 0) return;

  const entradaValor = parseValorBR(String(formData.get("entrada_valor") ?? "0")) ?? 0;
  const entradaData = String(formData.get("entrada_data") ?? "");
  const quantidade = Math.min(Math.max(Math.floor(Number(formData.get("quantidade") ?? 0)) || 0, 0), 600);
  const primeiro = String(formData.get("primeiro_vencimento") ?? "");
  const valorParcela = parseValorBR(String(formData.get("valor_parcela") ?? "0")) ?? 0;
  const jaPagas = Math.max(Math.floor(Number(formData.get("ja_pagas") ?? 0)) || 0, 0);

  if (entradaValor > valorTotal) return;
  if (quantidade > 0 && !dataValida(primeiro)) return;
  if (entradaValor > 0 && !dataValida(entradaData || primeiro)) return;

  const supabase = await createClient();
  const autor = await getAutorNomeDashboard();
  const { data: venda, error } = await supabase
    .from("vendas")
    .insert({
      cliente_nome: cliente,
      cliente_telefone: String(formData.get("cliente_telefone") ?? "").trim().slice(0, 40) || null,
      cliente_documento: String(formData.get("cliente_documento") ?? "").trim().slice(0, 30) || null,
      unidade: String(formData.get("unidade") ?? "").trim().slice(0, 80) || null,
      obra_id: String(formData.get("obra_id") ?? "") || null,
      valor_total: valorTotal,
      data_contrato: String(formData.get("data_contrato") ?? "") || null,
      observacao: String(formData.get("observacao") ?? "").trim().slice(0, 300) || null,
      created_by: autor,
    })
    .select("id")
    .single();
  if (error || !venda) {
    console.error("Erro ao criar venda:", error?.message);
    return;
  }

  const parcelas = gerarParcelas({
    valorTotal,
    entradaValor,
    entradaData: dataValida(entradaData) ? entradaData : null,
    quantidade,
    primeiroVencimento: dataValida(primeiro) ? primeiro : entradaData,
    valorParcela: valorParcela > 0 ? valorParcela : null,
  });
  if (parcelas.length > 0) {
    const { error: erroParcelas } = await supabase.from("parcelas_venda").insert(
      parcelas.map((p, i) => ({
        venda_id: venda.id,
        numero: p.numero,
        tipo: p.tipo,
        vencimento: p.vencimento,
        valor: p.valor,
        // As primeiras "ja pagas" entram como recebidas na data de vencimento (a conciliacao confirma depois).
        ...(i < jaPagas ? { status: "recebida" as const, recebido_em: p.vencimento, valor_recebido: p.valor } : {}),
      }))
    );
    if (erroParcelas) console.error("Erro ao criar parcelas:", erroParcelas.message);
  }
  await atualizarStatusDaVenda(venda.id);
  atualizarTelas();
}

export async function atualizarVendaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const cliente = String(formData.get("cliente_nome") ?? "").trim().slice(0, 120);
  const valorTotal = parseValorBR(String(formData.get("valor_total") ?? "0")) ?? 0;
  if (!id || !cliente || valorTotal <= 0) return;
  const cancelada = formData.get("cancelada") === "on";

  const supabase = await createClient();
  await supabase
    .from("vendas")
    .update({
      cliente_nome: cliente,
      cliente_telefone: String(formData.get("cliente_telefone") ?? "").trim().slice(0, 40) || null,
      cliente_documento: String(formData.get("cliente_documento") ?? "").trim().slice(0, 30) || null,
      unidade: String(formData.get("unidade") ?? "").trim().slice(0, 80) || null,
      obra_id: String(formData.get("obra_id") ?? "") || null,
      valor_total: valorTotal,
      data_contrato: String(formData.get("data_contrato") ?? "") || null,
      observacao: String(formData.get("observacao") ?? "").trim().slice(0, 300) || null,
      ...(cancelada ? { status: "cancelada" as const } : {}),
    })
    .eq("id", id);
  if (!cancelada) await atualizarStatusDaVenda(id);
  atualizarTelas();
}

/** Exclui a venda; as entradas do extrato que estavam ligadas a ela voltam a ficar sem classificacao. */
export async function excluirVendaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: parcelas } = await supabase.from("parcelas_venda").select("id").eq("venda_id", id);
  const ids = (parcelas ?? []).map((p) => p.id);
  if (ids.length > 0) {
    await supabase
      .from("extrato_transacoes")
      .update({ status: "pendente", classificacao: null, parcela_id: null, observacao: null })
      .in("parcela_id", ids);
  }
  await supabase.from("vendas").delete().eq("id", id);
  atualizarTelas();
}

export async function receberParcelaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const data = String(formData.get("recebido_em") ?? "");
  const valor = parseValorBR(String(formData.get("valor_recebido") ?? "0")) ?? 0;
  if (!id || !dataValida(data) || valor <= 0) return;
  const supabase = await createClient();
  const { data: parcela } = await supabase
    .from("parcelas_venda")
    .update({
      status: "recebida",
      recebido_em: data,
      valor_recebido: valor,
      conta_bancaria_id: String(formData.get("conta_bancaria_id") ?? "") || null,
    })
    .eq("id", id)
    .select("venda_id")
    .maybeSingle();
  if (parcela) await atualizarStatusDaVenda(parcela.venda_id);
  atualizarTelas();
}

/** So desfaz recebimento manual; o que veio da conciliacao se desfaz la (Desvincular). */
export async function desfazerRecebimentoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { count } = await supabase.from("extrato_transacoes").select("id", { count: "exact", head: true }).eq("parcela_id", id);
  if ((count ?? 0) > 0) return;
  const { data: parcela } = await supabase
    .from("parcelas_venda")
    .update({ status: "a_receber", recebido_em: null, valor_recebido: null, conta_bancaria_id: null })
    .eq("id", id)
    .select("venda_id")
    .maybeSingle();
  if (parcela) await atualizarStatusDaVenda(parcela.venda_id);
  atualizarTelas();
}

export async function atualizarParcelaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const vencimento = String(formData.get("vencimento") ?? "");
  const valor = parseValorBR(String(formData.get("valor") ?? "0")) ?? 0;
  if (!id || !dataValida(vencimento) || valor <= 0) return;
  const supabase = await createClient();
  const { data: parcela } = await supabase.from("parcelas_venda").update({ vencimento, valor }).eq("id", id).select("venda_id").maybeSingle();
  if (parcela) await atualizarStatusDaVenda(parcela.venda_id);
  atualizarTelas();
}

export async function excluirParcelaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("extrato_transacoes")
    .update({ status: "pendente", classificacao: null, parcela_id: null, observacao: null })
    .eq("parcela_id", id);
  const { data: parcela } = await supabase.from("parcelas_venda").select("venda_id").eq("id", id).maybeSingle();
  await supabase.from("parcelas_venda").delete().eq("id", id);
  if (parcela) await atualizarStatusDaVenda(parcela.venda_id);
  atualizarTelas();
}

export async function adicionarParcelaAction(formData: FormData) {
  const vendaId = String(formData.get("venda_id") ?? "");
  const vencimento = String(formData.get("vencimento") ?? "");
  const valor = parseValorBR(String(formData.get("valor") ?? "0")) ?? 0;
  const tipo = String(formData.get("tipo") ?? "parcela");
  if (!vendaId || !dataValida(vencimento) || valor <= 0) return;
  const tipoOk = ["entrada", "parcela", "intermediaria", "chaves", "outra"].includes(tipo) ? (tipo as "parcela") : "parcela";
  const supabase = await createClient();
  const { data: ultima } = await supabase.from("parcelas_venda").select("numero").eq("venda_id", vendaId).order("numero", { ascending: false }).limit(1);
  await supabase.from("parcelas_venda").insert({ venda_id: vendaId, numero: (ultima?.[0]?.numero ?? 0) + 1, tipo: tipoOk, vencimento, valor });
  await atualizarStatusDaVenda(vendaId);
  atualizarTelas();
}
