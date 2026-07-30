const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export type InvoiceItem = {
  descricao: string;
  quantidade: number;
  valorTotal: number;
};

export type TipoDocumentoExtraido =
  | "documento_cobranca"
  | "comprovante_pagamento"
  | "outro";

export type InvoiceData = {
  tipoDocumento: TipoDocumentoExtraido;
  fornecedorNome: string;
  fornecedorCnpj: string | null;
  fornecedorCpf: string | null;
  fornecedorChavePix: string | null;
  fornecedorContaBanco: string | null;
  fornecedorContaAgencia: string | null;
  fornecedorContaNumero: string | null;
  contaOrigemBanco: string | null;
  contaOrigemTitular: string | null;
  contaOrigemDocumento: string | null;
  contaOrigemAgencia: string | null;
  contaOrigemNumero: string | null;
  metodoPagamento: string | null;
  numeroDocumento: string | null;
  itens: InvoiceItem[];
  valorTotalNota: number | null;
};

const PROMPT = `Você recebeu a imagem/PDF de um documento financeiro de uma obra.

Classifique primeiro o documento:
- "documento_cobranca": nota fiscal, DANFE, fatura, boleto, conta de luz/água,
  recibo/conta que representa algo a pagar ou uma despesa a registrar.
- "comprovante_pagamento": comprovante Pix, TED, transferência, pagamento de
  boleto/conta, recibo bancário, tela com autenticação/transação concluída,
  documento que prova que o pagamento já foi realizado.
- "outro": quando não for possível identificar com segurança.

Depois extraia os dados em JSON.

Regras:
- "fornecedorNome": nome de quem recebeu o pagamento ou emitiu a cobrança
  (vendedor, prestador, empresa ou pessoa recebedora). Nunca use o nome do
  pagador como fornecedor. Se não encontrar, use "Não identificado".
- "fornecedorCnpj": CNPJ do emissor/recebedor (empresa), apenas dígitos. Use
  null se não encontrar.
- "fornecedorCpf": CPF do recebedor (quando pessoa física, ex: Pix pra
  autônomo/prestador), apenas dígitos. Use null se não encontrar ou se o
  recebedor for empresa (CNPJ). NUNCA confunda com "contaOrigemDocumento"
  abaixo, que é do PAGADOR, não do recebedor.
- "fornecedorChavePix": a chave Pix usada para pagar o recebedor (telefone,
  e-mail, CPF/CNPJ ou chave aleatória), quando o documento mostrar isso.
  Use null se não encontrar.
- "fornecedorContaBanco" / "fornecedorContaAgencia" / "fornecedorContaNumero":
  dados bancários do RECEBEDOR (banco, agência e número da conta de destino),
  quando aparecerem (ex: comprovante de TED/transferência mostrando pra onde
  o dinheiro foi). Use null se não encontrar. NUNCA confunda com os campos
  "contaOrigem*" abaixo, que são da conta de onde o dinheiro SAIU.
- Para comprovantes de pagamento, extraia também a conta de origem do dinheiro
  (a conta de quem PAGOU, não de quem recebeu):
  "contaOrigemBanco" é o banco/instituição de onde saiu o pagamento
  (ex: Caixa, Nubank, Itaú, Bradesco).
  "contaOrigemTitular" é o nome do pagador/titular/debitado/remetente.
  "contaOrigemDocumento" é CPF/CNPJ do pagador/titular, apenas dígitos.
  "contaOrigemAgencia" é a agência de origem, quando aparecer.
  "contaOrigemNumero" é o número da conta de origem, quando aparecer.
  "metodoPagamento" é Pix, TED, boleto, cartão, dinheiro, transferência ou outro.
  Use null nos campos que não aparecerem. Não confunda recebedor com conta de origem.
- "numeroDocumento": número da nota fiscal, fatura, boleto ou identificador/
  autenticação da transação/comprovante, quando aparecer no documento. Use
  null se não encontrar.
- "itens": se for nota/conta com vários produtos/serviços, retorne um item por
  produto/serviço. Se for um comprovante de pagamento único, retorne um único
  item com quantidade 1 e uma descrição clara do pagamento.
- "valorTotalNota": valor total do documento. Use null se não conseguir
  identificar.
- Responda APENAS com o JSON, sem texto adicional.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    tipoDocumento: {
      type: "string",
      enum: ["documento_cobranca", "comprovante_pagamento", "outro"],
    },
    fornecedorNome: { type: "string" },
    fornecedorCnpj: { type: "string", nullable: true },
    fornecedorCpf: { type: "string", nullable: true },
    fornecedorChavePix: { type: "string", nullable: true },
    fornecedorContaBanco: { type: "string", nullable: true },
    fornecedorContaAgencia: { type: "string", nullable: true },
    fornecedorContaNumero: { type: "string", nullable: true },
    contaOrigemBanco: { type: "string", nullable: true },
    contaOrigemTitular: { type: "string", nullable: true },
    contaOrigemDocumento: { type: "string", nullable: true },
    contaOrigemAgencia: { type: "string", nullable: true },
    contaOrigemNumero: { type: "string", nullable: true },
    metodoPagamento: { type: "string", nullable: true },
    numeroDocumento: { type: "string", nullable: true },
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
  required: [
    "tipoDocumento",
    "fornecedorNome",
    "fornecedorCpf",
    "fornecedorChavePix",
    "fornecedorContaBanco",
    "fornecedorContaAgencia",
    "fornecedorContaNumero",
    "contaOrigemBanco",
    "contaOrigemTitular",
    "contaOrigemDocumento",
    "contaOrigemAgencia",
    "contaOrigemNumero",
    "metodoPagamento",
    "numeroDocumento",
    "itens",
  ],
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
