import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export type Session = {
  telefone: string;
  estado_atual: string;
  dados_coletados: Record<string, Json>;
};

export const ESTADO_MENU = "menu";

export async function getSession(telefone: string): Promise<Session> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("telefone, estado_atual, dados_coletados")
    .eq("telefone", telefone)
    .maybeSingle();

  if (!data) {
    return { telefone, estado_atual: ESTADO_MENU, dados_coletados: {} };
  }

  return {
    telefone: data.telefone,
    estado_atual: data.estado_atual,
    dados_coletados: (data.dados_coletados as Record<string, Json>) ?? {},
  };
}

export async function saveSession(
  telefone: string,
  estado_atual: string,
  dados_coletados: Record<string, Json> = {}
) {
  const supabase = createAdminClient();
  await supabase.from("whatsapp_sessions").upsert({
    telefone,
    estado_atual,
    dados_coletados,
    updated_at: new Date().toISOString(),
  });
}

export async function resetSession(telefone: string) {
  await saveSession(telefone, ESTADO_MENU, {});
}
