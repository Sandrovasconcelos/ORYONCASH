"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerSaldoBR } from "@/lib/caixa/saldo";

const dataValida = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function atualizarTelas() {
  revalidatePath("/dashboard/contas");
  revalidatePath("/dashboard/fechamento");
}

/** Tipo da conta (corrente ou investimento) e a data a que o saldo inicial se refere. */
export async function configurarContaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const tipo = String(formData.get("tipo") ?? "corrente");
  const data = String(formData.get("data_saldo_inicial") ?? "");
  if (!id || (tipo !== "corrente" && tipo !== "investimento")) return;
  const supabase = await createClient();
  await supabase
    .from("contas_bancarias")
    .update({ tipo, data_saldo_inicial: dataValida(data) ? data : null })
    .eq("id", id);
  atualizarTelas();
}

/** Saldo que o banco mostra numa data (ou a posicao do investimento). Um por conta e dia. */
export async function registrarSaldoAction(formData: FormData) {
  const contaId = String(formData.get("conta_bancaria_id") ?? "");
  const data = String(formData.get("data") ?? "");
  const textoValor = String(formData.get("valor") ?? "").trim();
  const valor = lerSaldoBR(textoValor);
  if (!contaId || !dataValida(data) || valor === null || textoValor === "") return;
  const supabase = await createClient();
  await supabase.from("saldos_conta").upsert(
    {
      conta_bancaria_id: contaId,
      data,
      valor,
      observacao: String(formData.get("observacao") ?? "").trim().slice(0, 200) || null,
    },
    { onConflict: "conta_bancaria_id,data" }
  );
  atualizarTelas();
}

export async function excluirSaldoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("saldos_conta").delete().eq("id", id);
  atualizarTelas();
}
