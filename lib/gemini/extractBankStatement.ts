import { fetchComTimeout } from "@/lib/fetchComTimeout";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
// Extrato pode ter varias paginas/transacoes - demora mais que um documento
// unico, mas a action que chama isso tem maxDuration=60, entao ainda
// precisa sobrar tempo pra gravar tudo depois.
const GEMINI_TIMEOUT_MS = 50_000;

export type TransacaoExtrato = {
  data: string;
  descricao: string;
  valor: number;
  tipo: "debito" | "credito";
};

const PROMPT = `Você recebeu a imagem/PDF de um extrato bancário (pode ter
várias páginas e dezenas de transações).

Extraia TODAS as transações (débitos e créditos) em uma lista JSON.

Regras:
- "data": data da transação no formato AAAA-MM-DD. Se o extrato mostrar só
  dia/mês, use o ano do período do extrato (procure no cabeçalho).
- "descricao": a descrição/histórico da transação como aparece no extrato
  (ex: "PIX ENVIADO JOAO SILVA", "COMPRA CARTAO LOJA X", "TARIFA PACOTE
  SERVICOS"). Mantenha resumido mas identificável.
- "valor": valor da transação, sempre positivo (sem sinal).
- "tipo": "debito" quando o dinheiro saiu da conta (pagamento, saque,
  tarifa, transferência enviada), "credito" quando entrou (depósito,
  transferência recebida, estorno).
- Não invente transações. Se uma linha estiver ilegível, pule ela.
- Responda APENAS com o JSON, sem texto adicional.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    transacoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          data: { type: "string" },
          descricao: { type: "string" },
          valor: { type: "number" },
          tipo: { type: "string", enum: ["debito", "credito"] },
        },
        required: ["data", "descricao", "valor", "tipo"],
      },
    },
  },
  required: ["transacoes"],
};

export async function extractBankStatement(
  fileBuffer: Buffer,
  mimeType: string
): Promise<TransacaoExtrato[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  const res = await fetchComTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: fileBuffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
    GEMINI_TIMEOUT_MS
  );

  if (!res.ok) {
    throw new Error(`Falha ao chamar a API do Gemini (${res.status})`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as { transacoes: TransacaoExtrato[] };
    return parsed.transacoes ?? [];
  } catch {
    return [];
  }
}
