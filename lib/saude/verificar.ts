import { createAdminClient } from "@/lib/supabase/admin";
import { chamarGemini } from "@/lib/gemini/chamarGemini";
import { fetchComTimeout } from "@/lib/fetchComTimeout";
import { telegramCall } from "@/lib/telegram/api";

export type ResultadoCanal = { canal: string; ok: boolean; detalhe: string };

const GRAPH = process.env.WHATSAPP_API_VERSION || "v21.0";

export async function verificarWhatsApp(): Promise<ResultadoCanal> {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!id || !token) return { canal: "WhatsApp", ok: true, detalhe: "não configurado" };

  try {
    const res = await fetchComTimeout(
      `https://graph.facebook.com/${GRAPH}/${id}?fields=status,quality_rating,name_status,health_status`,
      { headers: { Authorization: `Bearer ${token}` } },
      10_000
    );
    const json = (await res.json().catch(() => ({}))) as {
      status?: string;
      quality_rating?: string;
      health_status?: { can_send_message?: string };
      error?: { message?: string; code?: number };
    };
    if (!res.ok) {
      return {
        canal: "WhatsApp",
        ok: false,
        detalhe: `token inválido ou sem permissão (${json.error?.code ?? res.status}) ${json.error?.message ?? ""}`.trim(),
      };
    }
    const bloqueado = json.health_status?.can_send_message === "BLOCKED";
    const conectado = json.status === "CONNECTED";
    if (!conectado || bloqueado) {
      return {
        canal: "WhatsApp",
        ok: false,
        detalhe: `número com status ${json.status ?? "desconhecido"}${bloqueado ? " (envio bloqueado pela Meta)" : ""}`,
      };
    }
    return { canal: "WhatsApp", ok: true, detalhe: `conectado, qualidade ${json.quality_rating ?? "?"}` };
  } catch (error) {
    return { canal: "WhatsApp", ok: false, detalhe: `sem resposta da Meta: ${(error as Error).message}` };
  }
}

export async function verificarTelegram(): Promise<ResultadoCanal> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { canal: "Telegram", ok: true, detalhe: "não configurado" };
  try {
    await telegramCall("getMe", {});
    const info = await telegramCall<{
      url?: string;
      last_error_date?: number;
      last_error_message?: string;
      pending_update_count?: number;
    }>("getWebhookInfo", {});

    if (!info.url?.endsWith("/api/telegram/webhook")) {
      return { canal: "Telegram", ok: false, detalhe: "webhook não está apontando pro sistema" };
    }
    const erroRecente = info.last_error_date && Date.now() - info.last_error_date * 1000 < 60 * 60 * 1000;
    if (erroRecente) {
      return { canal: "Telegram", ok: false, detalhe: `erro recente na entrega: ${info.last_error_message ?? "?"}` };
    }
    if ((info.pending_update_count ?? 0) > 10) {
      return { canal: "Telegram", ok: false, detalhe: `${info.pending_update_count} mensagens acumuladas sem processar` };
    }
    return { canal: "Telegram", ok: true, detalhe: "bot respondendo e webhook ok" };
  } catch (error) {
    return { canal: "Telegram", ok: false, detalhe: `bot inacessível: ${(error as Error).message}` };
  }
}

export async function verificarGemini(): Promise<ResultadoCanal> {
  try {
    const res = await chamarGemini(
      { contents: [{ parts: [{ text: "Responda apenas: ok" }] }] },
      { orcamentoMs: 25_000, contexto: "checagem de saude" }
    );
    await res.text().catch(() => "");
    return { canal: "Gemini", ok: true, detalhe: "respondendo" };
  } catch (error) {
    return { canal: "Gemini", ok: false, detalhe: `nenhum modelo respondeu: ${(error as Error).message}` };
  }
}

export async function verificarBanco(): Promise<ResultadoCanal> {
  try {
    const { error } = await createAdminClient().from("obras").select("id").limit(1);
    if (error) return { canal: "Banco de dados", ok: false, detalhe: error.message };
    return { canal: "Banco de dados", ok: true, detalhe: "ok" };
  } catch (error) {
    return { canal: "Banco de dados", ok: false, detalhe: (error as Error).message };
  }
}

/** Documentos que o leitor desistiu de ler, ou fila parada ha mais de 30 min. */
export async function verificarFilaLeituras(): Promise<ResultadoCanal> {
  const canal = "Leitura de documentos";
  try {
    const supabase = createAdminClient();
    const dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const meiaHora = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const [desistiu, parada] = await Promise.all([
      supabase
        .from("leituras_pendentes")
        .select("id", { count: "exact", head: true })
        .eq("status", "desistiu")
        .gte("updated_at", dia),
      supabase
        .from("leituras_pendentes")
        .select("id", { count: "exact", head: true })
        .in("status", ["pendente", "processando"])
        .lt("updated_at", meiaHora),
    ]);
    if (desistiu.error || parada.error) return { canal, ok: true, detalhe: "fila não disponível" };

    const nDesistiu = desistiu.count ?? 0;
    const nParada = parada.count ?? 0;
    if (nDesistiu > 0 || nParada > 0) {
      const partes = [
        nDesistiu > 0 ? `${nDesistiu} documento(s) que o leitor desistiu de ler nas últimas 24h` : "",
        nParada > 0 ? `${nParada} na fila há mais de 30 min` : "",
      ].filter(Boolean);
      return { canal, ok: false, detalhe: partes.join("; ") };
    }
    return { canal, ok: true, detalhe: "fila vazia" };
  } catch {
    return { canal, ok: true, detalhe: "fila não disponível" };
  }
}

export async function verificarTudo(): Promise<ResultadoCanal[]> {
  return Promise.all([
    verificarWhatsApp(),
    verificarTelegram(),
    verificarGemini(),
    verificarBanco(),
    verificarFilaLeituras(),
  ]);
}
