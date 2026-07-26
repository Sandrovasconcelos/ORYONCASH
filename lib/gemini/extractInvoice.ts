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

const PROMPT = `Voce recebeu a imagem/PDF de um documento de despesa de uma
obra de construcao. Pode ser uma nota fiscal (NF-e/DANFE) com varios
produtos, ou pode ser um comprovante simples: recibo de pagamento, comprovante
de PIX/transferencia, recibo de mao de obra, foto de um unico item comprado
com o preco escrito, etc. Extraia os dados no formato JSON abaixo.

Regras:
- "fornecedorNome": nome de quem RECEBEU o pagamento (vendedor, prestador de
  servico, pessoa que emitiu o recibo), nunca o destinatario/pagador. Se for
  um comprovante de PIX/transferencia sem nome de empresa, use o nome da
  pessoa/chave informada, ou "Não identificado" se nao houver nenhum nome.
- "fornecedorCnpj": CNPJ do emissor, apenas digitos (sem pontuacao). Use
  null se nao encontrar (normal em recibos simples).
- "itens": se for uma nota fiscal com varios produtos, um item para cada
  produto/servico, com a descricao reescrita de forma legivel (capitalizada,
  mantendo especificacoes como medidas/voltagem), a quantidade e o valor
  TOTAL daquele item (nao o valor unitario). Se for um comprovante/recibo de
  UM UNICO pagamento (ex.: pagamento de mao de obra, frete, servico), retorne
  um UNICO item com quantidade 1 e uma descricao clara do que foi pago (nunca
  deixe a descricao vazia ou generica como "despesa" - descreva o que
  especificamente foi pago, com base no que estiver escrito no documento).
- "valorTotalNota": valor total do documento. Use null se nao conseguir
  identificar.
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
