import { chamarGemini } from "@/lib/gemini/chamarGemini";

// Orcamento total de tempo (cadeia de modelos em chamarGemini), abaixo do
// teto de 60s do webhook.
const GEMINI_ORCAMENTO_MS = 40_000;

export type DespesaDeAudio = {
  valor: number | null;
  descricao: string | null;
  fornecedorNome: string | null;
  // Trechos citados na fala, ainda nao casados com o cadastro (o engine
  // tenta casar com obras/categorias/etapas e pergunta so o que faltar).
  obraMencionada?: string | null;
  categoriaMencionada?: string | null;
  etapaMencionada?: string | null;
};

const PROMPT = `Este e um audio (mensagem de voz do WhatsApp) em portugues, de
alguem descrevendo uma despesa que fez em uma obra de construcao (ex.:
"gastei 50 reais com o pedreiro", "paguei 200 de frete pro caminhao de
areia", "comprei tinta por 80 reais na loja tal").

Transcreva e extraia em JSON:
{
  "valor": number ou null se nao mencionar um valor em reais,
  "descricao": string curta (o que foi pago/comprado) ou null se nao ficar claro,
  "fornecedorNome": string com o nome do fornecedor/loja/pessoa mencionada, ou null,
  "obraMencionada": nome da obra citada (ex: "Costa Amalfitana"), ou null,
  "categoriaMencionada": tipo do gasto citado - ex: "Material", "Mão de obra",
    "Locação de equipamentos", "Corretagem" - ou null se nao ficar claro,
  "etapaMencionada": fase da obra citada (ex: "fundação", "alvenaria",
    "pintura", "1º mês"), ou null
}

Use null sempre que a pessoa NAO tiver dito. Nunca invente obra, categoria
ou etapa.

Responda APENAS com o JSON.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    valor: { type: "number", nullable: true },
    descricao: { type: "string", nullable: true },
    fornecedorNome: { type: "string", nullable: true },
    obraMencionada: { type: "string", nullable: true },
    categoriaMencionada: { type: "string", nullable: true },
    etapaMencionada: { type: "string", nullable: true },
  },
  required: ["valor", "descricao"],
};

async function extrairDespesa(parts: unknown[], contexto: string): Promise<DespesaDeAudio | null> {
  const res = await chamarGemini(
    {
      contents: [{ parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    },
    { orcamentoMs: GEMINI_ORCAMENTO_MS, contexto }
  );

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    return JSON.parse(text) as DespesaDeAudio;
  } catch {
    return null;
  }
}

export async function extractDespesaDeAudio(
  audioBuffer: Buffer,
  mimeTypeBruto: string
): Promise<DespesaDeAudio | null> {
  // O WhatsApp manda algo como "audio/ogg; codecs=opus" - o Gemini so aceita
  // o tipo base, sem os parametros de codec.
  const mimeType = mimeTypeBruto.split(";")[0].trim();
  return extrairDespesa(
    [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: audioBuffer.toString("base64") } }],
    "ler audio de despesa"
  );
}

/** Lancamento rapido por texto livre: "cimento 350 costa 02". */
export async function extractDespesaDeTexto(texto: string): Promise<DespesaDeAudio | null> {
  return extrairDespesa(
    [{ text: `${PROMPT.replace("Este e um audio (mensagem de voz do WhatsApp)", "Esta e uma mensagem de texto")}

Em texto digitado, um numero solto costuma ser o valor em reais (ex.:
"cimento 350 costa 02" = R$ 350 de cimento na obra "Costa 02"). Numeros
como "02" ou "01" junto ao nome de uma obra fazem parte do nome dela.

Mensagem:
${texto}` }],
    "ler texto de despesa"
  );
}
