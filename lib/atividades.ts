import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type Atividade = Database["public"]["Tables"]["atividades"]["Row"];

function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

function variantesTelefone(telefone: string): string[] {
  const numero = normalizarTelefone(telefone);
  const variantes = new Set([numero]);

  if (numero.startsWith("55")) {
    const ddd = numero.slice(2, 4);
    const resto = numero.slice(4);

    if (numero.length === 13 && resto.startsWith("9")) {
      variantes.add(`55${ddd}${resto.slice(1)}`);
    } else if (numero.length === 12) {
      variantes.add(`55${ddd}9${resto}`);
    }
  }

  return Array.from(variantes).filter(Boolean);
}

export async function getNomePorTelefone(telefone: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("usuarios_whatsapp")
    .select("nome")
    .in("telefone", variantesTelefone(telefone))
    .eq("ativo", true)
    .limit(1);

  return data?.[0]?.nome ?? normalizarTelefone(telefone);
}

export async function registrarAtividade(input: {
  tipo: Atividade["tipo"];
  entidade: Atividade["entidade"];
  entidadeId?: string | null;
  origem: Atividade["origem"];
  autorTelefone?: string | null;
  autorNome?: string | null;
  resumo: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("atividades").insert({
    tipo: input.tipo,
    entidade: input.entidade,
    entidade_id: input.entidadeId ?? null,
    origem: input.origem,
    autor_telefone: input.autorTelefone ?? null,
    autor_nome: input.autorNome ?? null,
    resumo: input.resumo,
    dados_antes: (input.dadosAntes ?? null) as never,
    dados_depois: (input.dadosDepois ?? null) as never,
  });
  if (error) {
    console.warn("Atividade nao registrada. Verifique a migration de auditoria:", {
      code: error.code,
      message: error.message,
    });
  }
}

export async function listAtividades(limite = 50) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("atividades")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  return data ?? [];
}
