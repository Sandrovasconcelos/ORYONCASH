const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export type DespesaDeAudio = {
  valor: number | null;
  descricao: string | null;
  fornecedorNome: string | null;
};

const PROMPT = `Este e um audio (mensagem de voz do WhatsApp) em portugues, de
alguem descrevendo uma despesa que fez em uma obra de construcao (ex.:
"gastei 50 reais com o pedreiro", "paguei 200 de frete pro caminhao de
areia", "comprei tinta por 80 reais na loja tal").

Transcreva e extraia em JSON:
{
  "valor": number ou null se nao mencionar um valor em reais,
  "descricao": string curta (o que foi pago/comprado) ou null se nao ficar claro,
  "fornecedorNome": string com o nome do fornecedor/loja/pessoa mencionada, ou null
}

Responda APENAS com o JSON.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    valor: { type: "number", nullable: true },
    descricao: { type: "string", nullable: true },
    fornecedorNome: { type: "string", nullable: true },
  },
  required: ["valor", "descricao"],
};

export async function extractDespesaDeAudio(
  audioBuffer: Buffer,
  mimeTypeBruto: string
): Promise<DespesaDeAudio | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  // O WhatsApp manda algo como "audio/ogg; codecs=opus" - o Gemini so aceita
  // o tipo base, sem os parametros de codec.
  const mimeType = mimeTypeBruto.split(";")[0].trim();

  const res = await fetch(
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
                  data: audioBuffer.toString("base64"),
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
    }
  );

  if (!res.ok) {
    throw new Error(`Falha ao chamar a API do Gemini (${res.status})`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    return JSON.parse(text) as DespesaDeAudio;
  } catch {
    return null;
  }
}
