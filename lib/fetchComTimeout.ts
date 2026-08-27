/**
 * fetch() sem timeout proprio fica pendurado indefinidamente se a API do
 * outro lado nao responder - isso e o que faz o webhook do WhatsApp travar
 * ate a Vercel matar a funcao no teto de 60s, sem chance de mandar
 * qualquer resposta pro usuario. Com AbortController, a chamada falha
 * previsivelmente bem antes disso, e o try/catch que ja existe em volta
 * das chamadas do Gemini cai no fallback manual normalmente.
 */
export async function fetchComTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Requisição excedeu ${timeoutMs}ms e foi cancelada`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
