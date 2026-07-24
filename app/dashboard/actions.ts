"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseValorBR } from "@/lib/conversation/format";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createObraAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const orcamentoTotal = parseValorBR(String(formData.get("orcamento") ?? "0")) ?? 0;
  if (!nome) return;

  const supabase = await createClient();
  await supabase.from("obras").insert({ nome, orcamento_total: orcamentoTotal });

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard");
}

export async function createMaterialAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const categoriaId = String(formData.get("categoria_id") ?? "") || null;
  if (!nome) return;

  const supabase = await createClient();
  await supabase.from("materiais").insert({ nome, categoria_id: categoriaId });

  revalidatePath("/dashboard/materiais");
}

export async function createFornecedorAction(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim() || null;
  if (!nome) return;

  const supabase = await createClient();
  await supabase.from("fornecedores").insert({ nome, contato });

  revalidatePath("/dashboard/fornecedores");
}
