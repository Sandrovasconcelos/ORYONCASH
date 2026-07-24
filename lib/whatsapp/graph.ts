const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

function endpoint() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

export async function sendWhatsAppMessage(payload: Record<string, unknown>) {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...payload,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Falha ao enviar mensagem no WhatsApp (${res.status}): ${errorBody}`
    );
  }

  return res.json();
}
