import { createAdminClient } from "@/lib/supabase/admin";
import type { ParcelaCandidata } from "./parcelas";

export type VendaResumida = { id: string; clienteNome: string; unidade: string | null; obraNome: string | null; valorTotal: number };

/**
 * Vendas ativas e parcelas em aberto, pro dono escolher na conciliacao a que
 * venda/parcela um credito do extrato se refere. Vazio (sem erro) enquanto as
 * tabelas nao existirem.
 */
export async function carregarVendasParaConciliacao(): Promise<{ vendas: VendaResumida[]; parcelasAbertas: ParcelaCandidata[] }> {
  const supabase = createAdminClient();
  const [vendasRes, parcelasRes] = await Promise.all([
    supabase
      .from("vendas")
      .select("id, cliente_nome, unidade, valor_total, obras(nome)")
      .eq("status", "ativa")
      .order("cliente_nome")
      .limit(500),
    supabase
      .from("parcelas_venda")
      .select("id, venda_id, numero, vencimento, valor, status, vendas!inner(cliente_nome, status)")
      .in("status", ["a_receber", "recebida"])
      .in("vendas.status", ["ativa", "quitada"])
      .order("vencimento")
      .limit(3000),
  ]);
  if (vendasRes.error || parcelasRes.error) return { vendas: [], parcelasAbertas: [] };

  const vendas = (vendasRes.data ?? []).map((v) => ({
    id: v.id,
    clienteNome: v.cliente_nome,
    unidade: v.unidade,
    obraNome: (v as { obras?: { nome: string } | null }).obras?.nome ?? null,
    valorTotal: v.valor_total,
  }));
  // Parcela ja marcada como recebida na mao ainda pode ser ligada ao credito do extrato (uma vez so).
  const { data: jaLigadas } = await supabase.from("extrato_transacoes").select("parcela_id").not("parcela_id", "is", null).limit(5000);
  const ligadas = new Set((jaLigadas ?? []).map((l) => l.parcela_id));
  const parcelasAbertas = (parcelasRes.data ?? [])
    .filter((p) => p.status === "a_receber" || !ligadas.has(p.id))
    .map((p) => ({
    id: p.id,
    vendaId: p.venda_id,
    clienteNome: (p as { vendas?: { cliente_nome: string } | null }).vendas?.cliente_nome ?? "",
    numero: p.numero,
    vencimento: p.vencimento,
    valor: p.valor,
  }));
  return { vendas, parcelasAbertas };
}

/** Marca a venda como quitada quando nao ha mais parcela em aberto e o recebido cobre o total (ou volta a ativa). */
export async function atualizarStatusDaVenda(vendaId: string): Promise<void> {
  const supabase = createAdminClient();
  const [{ data: venda }, { data: parcelas }] = await Promise.all([
    supabase.from("vendas").select("valor_total, status").eq("id", vendaId).maybeSingle(),
    supabase.from("parcelas_venda").select("status, valor, valor_recebido").eq("venda_id", vendaId),
  ]);
  if (!venda || venda.status === "cancelada") return;
  const emAberto = (parcelas ?? []).some((p) => p.status === "a_receber");
  const recebido = (parcelas ?? []).filter((p) => p.status === "recebida").reduce((s, p) => s + (p.valor_recebido ?? p.valor), 0);
  const quitada = !emAberto && recebido + 0.009 >= venda.valor_total;
  const novo = quitada ? "quitada" : "ativa";
  if (novo !== venda.status) await supabase.from("vendas").update({ status: novo }).eq("id", vendaId);
}
