import { chamarGemini } from "@/lib/gemini/chamarGemini";

const GEMINI_ORCAMENTO_MS = 20_000;

export type TipoFiltroRelatorio = "categoria" | "material" | "fornecedor" | "etapa" | "obra" | "geral";

export type PeriodoRelativo =
  | "hoje"
  | "ontem"
  | "semana_atual"
  | "mes_atual"
  | "mes_passado"
  | "ano_atual"
  | "personalizado";

export type PerguntaRelatorio = {
  ehPerguntaDeGasto: boolean;
  tipo: TipoFiltroRelatorio | null;
  /** true = "qual/quem X mais gastou" (quer o MAIOR, sem um nome especifico). */
  ranking: boolean;
  /** Palavra-chave curta pra casar com o cadastro (ex: "Alex", "cimento") - nunca a frase inteira. Null quando ranking=true. */
  termoBusca: string | null;
  periodo: PeriodoRelativo | null;
  /** So preenchido quando periodo === "personalizado" (datas explicitas tipo "de 01/01 a 30/06"). */
  dataInicioPersonalizada: string | null;
  dataFimPersonalizada: string | null;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    ehPerguntaDeGasto: { type: "boolean" },
    tipo: { type: "string", enum: ["categoria", "material", "fornecedor", "etapa", "obra", "geral"], nullable: true },
    ranking: { type: "boolean" },
    termoBusca: { type: "string", nullable: true },
    periodo: {
      type: "string",
      enum: ["hoje", "ontem", "semana_atual", "mes_atual", "mes_passado", "ano_atual", "personalizado"],
      nullable: true,
    },
    dataInicioPersonalizada: { type: "string", nullable: true },
    dataFimPersonalizada: { type: "string", nullable: true },
  },
  required: ["ehPerguntaDeGasto"],
};

function montarPrompt(pergunta: string, hoje: string): string {
  return `Uma pessoa mandou esta mensagem num bot de controle financeiro de obras:

"${pergunta}"

Hoje é ${hoje} (AAAA-MM-DD).

Diga se é uma PERGUNTA sobre gastos (ex: "quanto gastei com cimento", "quanto já
gastei com a mão de obra do Alex", "qual fornecedor mais gastou essa semana",
"quem mais recebeu esse mês", "total de material em setembro") - e não outra
coisa (lançar uma despesa nova, tirar dúvida, conversa aleatória).

Se for, identifique:

- "tipo": sobre o que ela é -
  "categoria" (tipo de gasto, ex: mão de obra, material, locação de equipamento),
  "material" (um material específico, ex: cimento, areia, tijolo),
  "fornecedor" (uma empresa/pessoa que vendeu/prestou serviço),
  "etapa" (fase da obra, ex: alvenaria, fundação, pintura),
  "obra" (uma obra/construção específica),
  "geral" (gasto total, sem filtro - ex: "quanto eu já gastei no total").
  Atenção: "a mão de obra do/da [nome de pessoa]" costuma ser o NOME de uma
  categoria cadastrada (ex: "Mão de Obra Alex"), não um fornecedor - nesse
  caso "tipo" é "categoria" e "termoBusca" é o nome da pessoa.

- "ranking": true quando a pergunta pede o MAIOR/MENOR de um tipo, sem
  especificar qual (ex: "qual fornecedor mais gastou", "quem mais recebeu",
  "qual categoria consome mais") - nesse caso "termoBusca" é null. false
  quando já vem um nome específico (ex: "quanto gastei com a Marsol").

- "termoBusca": SÓ a palavra-chave distintiva mencionada (quando ranking for
  false), SEM artigos/preposições ("do", "da", "com", "em", "no") e sem a
  palavra "gasto"/"gastei" - ex: de "a mão de obra do Alex" extraia "Alex";
  de "o fornecedor Marsol" extraia "Marsol". Null se tipo for "geral", se
  ranking for true, ou se não identificar.

- "periodo": SÓ se a pessoa mencionar um período explícito, um destes:
  "hoje", "ontem", "semana_atual" (esta semana), "mes_atual" (este mês),
  "mes_passado", "ano_atual" (este ano), ou "personalizado" (datas
  explícitas tipo "de 01/01 a 30/06" ou um mês específico como "em
  setembro" - nesse caso preencha "dataInicioPersonalizada" e
  "dataFimPersonalizada", AAAA-MM-DD, calculadas a partir de hoje). Null se
  não mencionar período (relatório cobre tudo).

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
