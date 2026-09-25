import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

/**
 * Fila de leituras que o Gemini nao conseguiu fazer na hora (todos os
 * modelos sobrecarregados/fora do ar). Em vez de largar o usuario no
 * preenchimento manual, o arquivo (ja salvo no Storage) fica na fila e uma
 * cadeia de tentativas em segundo plano le de novo ate conseguir.
 *
 * Sem cron por minuto (o plano so permite diario), a cadeia se auto-encadeia:
 * cada tentativa e uma chamada a /api/gemini/reprocessar que responde 202 na
 * hora, faz o trabalho em segundo plano (after) e, se falhar, dispara a
 * proxima. Uma varredura diaria retoma cadeias interrompidas (deploy,
 * queda da funcao).
 */

export const MAX_TENTATIVAS = 8;
// Espera antes de cada tentativa: cresce um pouco pra dar tempo do provedor
// se recuperar sem estourar os 60s da funcao (espera + leitura de ~35s).
export function esperaAntesDaTentativa(tentativasFeitas: number): number {
  return Math.min(8_000 + tentativasFeitas * 3_000, 20_000);
}
// Cadeia parada (pendente/processando sem atualizar) ha mais que isso e
// considerada interrompida e pode ser retomada pela varredura.
const CADEIA_PARADA_MS = 5 * 60_000;

export type ComprovanteSalvo = {
  bucket: string;
  path: string;
  mimeType: string;
  [chave: string]: Json | undefined;
};

export type LeituraPendente = {
  id: string;
  telefone: string;
  comprovante: ComprovanteSalvo;
  forcar_nova_despesa: boolean;
  tentativas: number;
  status: string;
  created_at: string;
};

function urlBase(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // Sempre o dominio de producao: a URL unica de cada deploy (VERCEL_URL)
  // pode estar atras da protecao de deploy da Vercel e recusar a chamada.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL) return "https://oryoncash.vercel.app";
  return "http://localhost:3000";
}

/** Dispara (sem esperar o trabalho) a proxima tentativa da cadeia. */
export async function dispararTentativa(id: string, esperaMs: number): Promise<boolean> {
  try {
    const res = await fetch(`${urlBase()}/api/gemini/reprocessar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ id, esperaMs }),
      // A rota responde 202 na hora; so garante que a chamada saiu.
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch (error) {
    console.error("Falha ao disparar tentativa de leitura pendente:", error);
    return false;
  }
}

/**
 * Coloca o documento na fila e dispara a primeira tentativa. Devolve false
 * se nao der pra garantir a fila (ex: tabela ainda nao criada) - quem chama
 * cai no fluxo manual de antes.
 */
export async function agendarLeituraPendente(input: {
  telefone: string;
  comprovante: ComprovanteSalvo;
  forcarNovaDespesa: boolean;
}): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("leituras_pendentes")
      .insert({
        telefone: input.telefone,
        comprovante: input.comprovante as Json,
        forcar_nova_despesa: input.forcarNovaDespesa,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Nao consegui enfileirar leitura pendente:", error?.message);
      return false;
    }
    const disparou = await dispararTentativa(data.id, esperaAntesDaTentativa(0));
    if (!disparou) {
      // Fila salva; a varredura diaria retoma. Ainda assim avisa o usuario.
      console.error(`Leitura pendente ${data.id} salva, mas a 1a tentativa nao foi disparada`);
    }
    return true;
  } catch (error) {
    console.error("Erro ao agendar leitura pendente:", error);
    return false;
  }
}

/** Reserva a tentativa (evita duas cadeias na mesma leitura). */
export async function reservarTentativa(id: string): Promise<LeituraPendente | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leituras_pendentes")
    .update({ status: "processando", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id, telefone, comprovante, forcar_nova_despesa, tentativas, status, created_at")
    .maybeSingle();
  return (data as unknown as LeituraPendente | null) ?? null;
}

export async function marcarLeitura(
  id: string,
  campos: { status: "pendente" | "concluida" | "desistiu"; tentativas?: number; ultimo_erro?: string | null }
) {
  const supabase = createAdminClient();
  await supabase
    .from("leituras_pendentes")
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Varredura (roda no cron diario): retoma cadeias interrompidas - leituras
 * "pendente"/"processando" sem atualizacao ha mais de 5 min.
 */
export async function retomarLeiturasPendentes(): Promise<number> {
  const supabase = createAdminClient();
  const limite = new Date(Date.now() - CADEIA_PARADA_MS).toISOString();
  const { data } = await supabase
    .from("leituras_pendentes")
    .select("id, tentativas, status")
    .in("status", ["pendente", "processando"])
    .lt("updated_at", limite)
    .limit(20);

  let retomadas = 0;
  for (const item of data ?? []) {
    if (item.status === "processando") {
      await supabase.from("leituras_pendentes").update({ status: "pendente" }).eq("id", item.id);
    }
    if (await dispararTentativa(item.id, 0)) retomadas++;
  }
  return retomadas;
}
