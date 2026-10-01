import { chamarGemini } from "@/lib/gemini/chamarGemini";

const GEMINI_ORCAMENTO_MS = 20_000;

export type TipoFiltroRelatorio = "categoria" | "material" | "fornecedor" | "etapa" | "obra" | "geral";

export type PerguntaRelatorio = {
  ehPerguntaDeGasto: boolean;
  tipo: TipoFiltroRelatorio | null;
  /** Palavra-chave curta pra casar com o cadastro (ex: "Alex", "cimento") - nunca a frase inteira. */
  termoBusca: string | null;
  dataInicio: string | null;
  dataFim: string | null;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    ehPerguntaDeGasto: { type: "boolean" },
    tipo: { type: "string", enum: ["categoria", "material", "fornecedor", "etapa", "obra", "geral"], nullable: true },
    termoBusca: { type: "string", nullable: true },
    dataInicio: { type: "string", nullable: true },
    dataFim: { type: "string", nullable: true },
  },
  required: ["ehPerguntaDeGasto"],
};

function montarPrompt(pergunta: string, hoje: string): string {
  return `Uma pessoa mandou esta mensagem num bot de controle financeiro de obras:

"${pergunta}"

Hoje é ${hoje} (AAAA-MM-DD).

Diga se é uma PERGUNTA sobre quanto já foi gasto (ex: "quanto gastei com cimento",
"quanto já gastei com a mão de obra do Alex", "quanto foi gasto com o fornecedor
Marsol", "total de material em setembro") - e não outra coisa (lançar uma despesa
nova, tirar dúvida, conversa aleatória).

Se for uma pergunta de gasto, identifique:
- "tipo": sobre o que ela pergunta -
  "categoria" (tipo de gasto, ex: mão de obra, material, locação de equipamento),
  "material" (um material específico, ex: cimento, areia, tijolo),
  "fornecedor" (uma empresa/pessoa que vendeu/prestou serviço),
  "etapa" (fase da obra, ex: alvenaria, fundação, pintura),
  "obra" (uma obra/construção específica),
  "geral" (gasto total, sem filtro - ex: "quanto eu já gastei no total").
  Atenção: "a mão de obra do/da [nome de pessoa]" costuma ser o NOME de uma
  categoria cadastrada (ex: "Mão de Obra Alex"), não um fornecedor - nesse
  caso "tipo" é "categoria" e "termoBusca" é o nome da pessoa.
- "termoBusca": SÓ a palavra-chave distintiva mencionada, SEM artigos/preposições
  ("do", "da", "com", "em", "no") e sem a palavra "gasto"/"gastei" - ex: de "a mão
  de obra do Alex" extraia "Alex" (ou "mao de obra alex" se o nome dela for
  composto); de "o fornecedor Marsol" extraia "Marsol"; de "quanto gastei com
  cimento" extraia "cimento". Null se tipo for "geral" ou não identificar.
- "dataInicio"/"dataFim" (AAAA-MM-DD): SÓ se a pessoa mencionar um período
  explícito ("em setembro", "esse mês", "ano passado", "de 01/01 a 30/06").
  Resolva relativo a hoje. Null se não mencionar período (relatório cobre tudo).

Responda APENAS com o JSON.`;
}

export async function interpretarPerguntaRelatorio(
  pergunta: string,
  hoje: string
): Promise<PerguntaRelatorio | null> {
  try {
    const res = await chamarGemini(
      {
        contents: [{ parts: [{ text: montarPrompt(pergunta, hoje) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      },
      { orcamentoMs: GEMINI_ORCAMENTO_MS, contexto: "interpretar pergunta de relatório" }
    );

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return JSON.parse(text) as PerguntaRelatorio;
  } catch (error) {
    console.error("Erro ao interpretar pergunta de relatório:", error);
    return null;
  }
}
