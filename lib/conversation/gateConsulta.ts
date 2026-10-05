function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const PALAVRA_DE_PERGUNTA = /\b(quanto|quanta|quantos|quantas|qual|quais|quem|total|falta|sobrou|estourou|tenho|devo|vence|vencem|tem)\b/;

/**
 * Filtro barato antes de chamar o Gemini: so passa o que tem cara de
 * pergunta sobre gasto, orcamento, comparacao ou contas a pagar. O Gemini
 * ainda confirma de verdade - isto so evita gastar chamada em conversa comum
 * (e em respostas de fluxos, tipo descricao de uma despesa).
 */
export function pareceConsulta(texto: string): boolean {
  const t = semAcento(texto.trim());
  if (t.length < 6) return false;

  // gasto: "quanto gastei com...", "qual fornecedor mais gastou..."
  if (/gast/.test(t) && PALAVRA_DE_PERGUNTA.test(t)) return true;

  // orcamento: "quanto falta do orcamento da obra X"
  if (/orcament/.test(t) && PALAVRA_DE_PERGUNTA.test(t)) return true;

  // comparativo: "gastei mais ou menos que o mes passado?"
  if (/(mais|menos).{0,30}(que|do que)|compar/.test(t) && /gast|despes|pagu/.test(t)) return true;

  // contas a pagar: "quanto eu devo", "o que vence essa semana", "contas a pagar"
  if (/quanto (eu )?(ainda )?devo|contas? a pagar|o que (vence|vai vencer|tenho (pra|para) pagar)|boletos? (vencid|pendente|a vencer)|contas? vencid/.test(t)) {
    return PALAVRA_DE_PERGUNTA.test(t) || /\?/.test(t) || /contas? a pagar/.test(t);
  }

  return false;
}
