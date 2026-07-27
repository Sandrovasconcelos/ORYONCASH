import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * O wa_id que o Meta envia no webhook as vezes vem sem o "9" adicional dos
 * celulares brasileiros (ex.: bot recebe 559888219864 mas o numero real e
 * 5598988219864). Gera as duas variantes para nao barrar por engano um
 * numero autorizado.
 */
function variantesTelefone(numero: string): string[] {
  const variantes = new Set([numero]);
  if (numero.startsWith("55")) {
    const resto = numero.slice(4); // depois de "55" + DDD (2 digitos)
    const ddd = numero.slice(2, 4);
    if (numero.length === 13 && resto.startsWith("9")) {
      variantes.add(`55${ddd}${resto.slice(1)}`);
    } else if (numero.length === 12) {
      variantes.add(`55${ddd}9${resto}`);
    }
  }
  return Array.from(variantes);
}

/**
 * Autorizacao self-service: numeros ficam cadastrados em usuarios_whatsapp
 * (gerenciados pelo dashboard em /dashboard/numeros), no lugar do antigo
 * env var ALLOWED_WHATSAPP_NUMBERS que exigia redeploy para cada numero novo.
 */
export async function isAllowedNumber(phoneNumber: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("usuarios_whatsapp")
    .select("telefone, ativo")
    .in("telefone", variantesTelefone(phoneNumber));

  return (data ?? []).some((u) => u.ativo);
}
