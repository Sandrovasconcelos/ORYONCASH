/**
 * fetch() sem timeout proprio fica pendurado indefinidamente se a API do
 * outro lado nao responder - isso e o que faz o webhook do WhatsApp travar
 * ate a Vercel matar a funcao no teto de 60s, sem chance de mandar
 * qualquer resposta pro usuario. Com AbortController, a chamada falha
 * previsivelmente bem antes disso, e o try/catch que ja existe em volta
 * das chamadas do Gemini cai no fallback manual normalmente.
 *
 * `retries` reenvia SO quando a resposta veio rapido com 503 (sobrecarga
 * do modelo, comum em picos de demanda do Gemini) ou 429 (rate limit) -
 * esses dois falham na hora, entao um retry custa só ~1s extra. Nunca
 * reenvia depois de um timeout/abort (a chamada ja consumiu o timeoutMs
 * inteiro sem responder) - dobrar a espera nesse caso facilmente estoura
 * o teto de 60s da function inteira antes mesmo do retry terminar.
 */
export async function fetchComTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  retries = 0
): Promise<Response> {
  for (let tentativa = 0; tentativa <= retries; tentativa++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      if ((res.status === 503 || res.status === 429) && tentativa < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      return res;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Requisição excedeu ${timeoutMs}ms e foi cancelada`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("fetchComTimeout: número de tentativas esgotado sem sucesso");
}
