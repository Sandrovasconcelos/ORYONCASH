/**
 * fetch() sem timeout proprio fica pendurado indefinidamente se a API do
 * outro lado nao responder - isso e o que faz o webhook do WhatsApp travar
 * ate a Vercel matar a funcao no teto de 60s, sem chance de mandar
 * qualquer resposta pro usuario. Com AbortController, a chamada falha
 * previsivelmente bem antes disso, e o try/catch que ja existe em volta
 * das chamadas do Gemini cai no fallback manual normalmente.
 *
 * `retries` reenvia automaticamente quando a resposta vem com 503
 * (sobrecarga do modelo, comum em picos de demanda do Gemini) ou 429
 * (rate limit) - erros tipicamente transitorios que passam numa segunda
 * tentativa poucos segundos depois. Erros de rede (timeout, DNS, etc)
 * tambem contam como tentativa - so nao reenvia em erros que nao sao de
 * disponibilidade (4xx que nao seja 429, por exemplo).
 */
export async function fetchComTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  retries = 0
): Promise<Response> {
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa <= retries; tentativa++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      if ((res.status === 503 || res.status === 429) && tentativa < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (tentativa + 1)));
        continue;
      }
      return res;
    } catch (error) {
      ultimoErro =
        error instanceof Error && error.name === "AbortError"
          ? new Error(`Requisição excedeu ${timeoutMs}ms e foi cancelada`)
          : error;
      if (tentativa < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (tentativa + 1)));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw ultimoErro;
}
