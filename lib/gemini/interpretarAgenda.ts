import { chamarGemini } from "@/lib/gemini/chamarGemini";
import { proximosDias } from "@/lib/agenda/datas";

const GEMINI_ORCAMENTO_MS = 20_000;

export type PedidoAgenda = {
  ehAgenda: boolean;
  acao: "criar" | "listar" | "cancelar" | null;
  /** O que e o compromisso (ex: "Reunião com o Marsol"). */
  titulo: string | null;
  /** AAAA-MM-DD, horario de Brasilia. */
  data: string | null;
  /** HH:MM, 24h. Null quando a pessoa nao disse a hora. */
  hora: string | null;
  local: string | null;
  lembrarMinAntes: number | null;
  /** Para "listar". */
  periodo: "hoje" | "amanha" | "semana" | "proximos" | "data" | null;
  /** Para "cancelar": palavra-chave do compromisso. */
  termoBusca: string | null;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    ehAgenda: { type: "boolean" },
    acao: { type: "string", enum: ["criar", "listar", "cancelar"], nullable: true },
    titulo: { type: "string", nullable: true },
    data: { type: "string", nullable: true },
    hora: { type: "string", nullable: true },
    local: { type: "string", nullable: true },
    lembrarMinAntes: { type: "number", nullable: true },
    periodo: { type: "string", enum: ["hoje", "amanha", "semana", "proximos", "data"], nullable: true },
    termoBusca: { type: "string", nullable: true },
  },
  required: ["ehAgenda"],
};

function montarPrompt(mensagem: string, hoje: string): string {
  const calendario = proximosDias(hoje, 15)
    .map((d) => `${d.diaSemana} ${d.data}`)
    .join(", ");

  return `Uma pessoa mandou esta mensagem pro assistente pessoal dela no WhatsApp:

"${mensagem}"

Hoje é ${hoje}. Calendário dos próximos dias (use SEMPRE esta lista pra descobrir a
data de "quinta", "sexta que vem", "amanhã" etc. - não calcule de cabeça):
${calendario}

Diga se é um pedido de AGENDA (marcar/lembrar de algo, ver compromissos, cancelar um
compromisso) - e não outra coisa (lançar despesa, pergunta de gasto, conversa).

Se for, preencha:
- "acao": "criar" (marcar compromisso/reunião/lembrete), "listar" (ver a agenda) ou "cancelar".
- Para "criar": "titulo" curto e claro (ex: "Reunião com o Marsol", "Ligar pro Alex",
  "Pagar o condomínio"), "data" (AAAA-MM-DD, pelo calendário acima), "hora" (HH:MM em 24h;
  "3 da tarde" = 15:00; null se a pessoa NÃO disse hora - nunca invente), "local" (se
  citado) e "lembrarMinAntes" (só se pediu um aviso com antecedência específica, ex: "me
  avisa 1 hora antes" = 60; senão null).
- Para "listar": "periodo" = "hoje", "amanha", "semana" (esta semana), "proximos" (sem
  período citado: próximos dias) ou "data" (um dia específico: preencha "data").
- Para "cancelar": "termoBusca" = palavra-chave do compromisso (ex: "Marsol"), e "data"
  se ela citou o dia.

REGRAS DE FORMATO: "titulo" tem no MÁXIMO 6 palavras, sem explicações nem comentários
(se a pessoa só disse "dentista", o título é "Dentista"). Se faltar a hora ou a data,
deixe esse campo null e NÃO escreva justificativas em nenhum campo.

Responda APENAS com o JSON.`;
}

export async function interpretarAgenda(mensagem: string, hoje: string): Promise<PedidoAgenda | null> {
  try {
    const res = await chamarGemini(
      {
        contents: [{ parts: [{ text: montarPrompt(mensagem, hoje) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      },
      { orcamentoMs: GEMINI_ORCAMENTO_MS, contexto: "interpretar pedido de agenda" }
    );
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as PedidoAgenda;
  } catch (error) {
    console.error("Erro ao interpretar pedido de agenda:", error);
    return null;
  }
}
