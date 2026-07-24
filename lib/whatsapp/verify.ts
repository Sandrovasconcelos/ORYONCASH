import { createHmac, timingSafeEqual } from "crypto";

/**
 * Valida o header X-Hub-Signature-256 que o Meta envia em cada POST do
 * webhook, usando o App Secret. Protege contra requisicoes forjadas para
 * a rota do webhook.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected = `sha256=${createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function isAllowedNumber(phoneNumber: string): boolean {
  const allowed = (process.env.ALLOWED_WHATSAPP_NUMBERS || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  return allowed.includes(phoneNumber);
}
