const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export type InvoiceItem = {
  descricao: string;
  quantidade: number;
  valorTotal: number;
};

export type InvoiceData = {
  fornecedorNome: string;
  fornecedorCnpj: string | null;
  itens: InvoiceItem[];
  valorTotalNota: number | null;
};

const PROMPT = `Voce recebeu uma nota fiscal (NF-e/DANFE) ou comprovante de
compra de material de construcao, em imagem ou PDF. Extraia os dados no
formato JSON abaixo.

Regras:
- "fornecedorNome": nome/razao social de quem EMITIU a nota (o vendedor),
  nunca o destinatario/comprador.
- "fornecedorCnpj": CNPJ do emissor, apenas digitos (sem pontuacao). Use
  null se nao encontrar.
- "itens": um item para cada produto/servico listado, com a descricao
  reescrita de forma legivel (capitalizada, mantendo especificacoes como
  medidas/voltagem), a quantidade e o valor TOTAL daquele item (nao o valor
  unitario).
- "valorTotalNota": valor total da nota/comprovante. Use null se nao
  conseguir identificar.
- Responda APENAS com o JSON, sem texto adicional.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fornecedorNome: { type: "string" },
    fornecedorCnpj: { type: "string", nullable: true },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          quantidade: { type: "number" },
          valorTotal: { type: "number" },
        },
        required: ["descricao", "quantidade", "valorTotal"],
      },
    },
    valorTotalNota: { type: "number", nullable: true },
  },
  required: ["fornecedorNome", "itens"],
};

export async function extractInvoiceData(
  fileBuffer: Buffer,
  mimeType: string
): Promise<InvoiceData | null> {
  const apiKey = process.env.GEMINI_API_KEY;

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
    return JSON.parse(text) as InvoiceData;
  } catch {
    return null;
  }
}
