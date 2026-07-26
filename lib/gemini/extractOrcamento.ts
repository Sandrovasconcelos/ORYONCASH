const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export type OrcamentoEtapa = {
  nome: string;
  valorOrcado: number;
};

export type OrcamentoData = {
  etapas: OrcamentoEtapa[];
  valorTotal: number | null;
};

const PROMPT = `O texto abaixo e o despejo (em CSV, uma ou mais abas) de uma
planilha orçamentária de uma obra de construção civil brasileira. O
layout exato varia de planilha para planilha, mas normalmente existe uma
aba de resumo com as macro-etapas do projeto (ex.: "Serviços
Preliminares", "Fundação", "Supra-Estrutura", "Instalações Elétricas"
etc.) e o valor total orçado de cada uma.

Tarefa: identifique a lista de etapas/macro-serviços do projeto com seus
valores TOTAIS orçados (prefira a aba de resumo/sintética, ignore listas
de itens individuais/insumos muito detalhadas quando houver um resumo por
etapa disponível). Responda em JSON:
{
  "etapas": [{ "nome": string, "valorOrcado": number }],
  "valorTotal": number ou null se não encontrar um total geral claro
}

Regras:
- "nome" deve ser legível (capitalizado corretamente), mantendo o sentido
  original da etapa.
- "valorOrcado" e "valorTotal" sao numeros (sem formataçao de moeda).
- Responda APENAS com o JSON.

Texto da planilha:
`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    etapas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          valorOrcado: { type: "number" },
        },
        required: ["nome", "valorOrcado"],
      },
    },
    valorTotal: { type: "number", nullable: true },
  },
  required: ["etapas"],
};

export async function extractOrcamentoData(
  sheetsText: string
): Promise<OrcamentoData | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + sheetsText }] }],
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
    return JSON.parse(text) as OrcamentoData;
  } catch {
    return null;
  }
}
