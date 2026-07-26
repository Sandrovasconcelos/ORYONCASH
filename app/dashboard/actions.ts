"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseValorBR } from "@/lib/conversation/format";
import { upsertEtapasDeObra } from "@/lib/conversation/queries";
import { extractSpreadsheetAsText } from "@/lib/orcamento/parseSpreadsheet";
import { extractOrcamentoData } from "@/lib/gemini/extractOrcamento";

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

export type ImportarOrcamentoResultado =
  | { ok: true; etapas: number }
  | { ok: false; erro: string };

export async function importarOrcamentoAction(
  formData: FormData
): Promise<ImportarOrcamentoResultado> {
  const obraId = String(formData.get("obra_id") ?? "");
  const arquivo = formData.get("arquivo") as File | null;

  if (!obraId || !arquivo || arquivo.size === 0) {
    return { ok: false, erro: "Selecione uma obra e um arquivo .xlsx." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let texto: string;
  try {
    texto = extractSpreadsheetAsText(buffer);
  } catch {
    return { ok: false, erro: "Não consegui abrir esse arquivo como planilha." };
  }

  const orcamento = await extractOrcamentoData(texto);
  if (!orcamento || orcamento.etapas.length === 0) {
    return {
      ok: false,
      erro:
        "Não consegui identificar as etapas nessa planilha. Confira se ela tem um resumo por etapa com os valores totais.",
    };
  }

  await upsertEtapasDeObra(obraId, orcamento.etapas);

  revalidatePath("/dashboard/obras");
  revalidatePath("/dashboard");

  return { ok: true, etapas: orcamento.etapas.length };
}
