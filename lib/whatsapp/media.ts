const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

/**
 * Baixa uma midia recebida no WhatsApp (imagem/documento) a partir do seu
 * media id. Duas etapas: resolver a URL temporaria, depois baixar os bytes
 * (ambas exigem o token de acesso do app).
 */
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  const metaRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) {
    throw new Error(`Falha ao resolver URL da midia (${metaRes.status})`);
  }
  const meta = (await metaRes.json()) as { url: string; mime_type: string };

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Falha ao baixar midia (${fileRes.status})`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type };
}
