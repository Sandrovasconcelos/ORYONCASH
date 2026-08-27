import { fetchComTimeout } from "@/lib/fetchComTimeout";

const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
// Duas chamadas sequenciais (resolver URL + baixar bytes) dividem o
// orcamento de 60s da function com o Gemini depois - 10s cada deixa
// margem suficiente pras duas sem comer o tempo que o Gemini precisa.
const GRAPH_TIMEOUT_MS = 8_000;

/**
 * Baixa uma midia recebida no WhatsApp (imagem/documento) a partir do seu
 * media id. Duas etapas: resolver a URL temporaria, depois baixar os bytes
 * (ambas exigem o token de acesso do app).
 */
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  const metaRes = await fetchComTimeout(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    { headers: { Authorization: `Bearer ${token}` } },
    GRAPH_TIMEOUT_MS
  );
  if (!metaRes.ok) {
    throw new Error(`Falha ao resolver URL da midia (${metaRes.status})`);
  }
  const meta = (await metaRes.json()) as { url: string; mime_type: string };

  const fileRes = await fetchComTimeout(
    meta.url,
    { headers: { Authorization: `Bearer ${token}` } },
    GRAPH_TIMEOUT_MS
  );
  if (!fileRes.ok) {
    throw new Error(`Falha ao baixar midia (${fileRes.status})`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type };
}
