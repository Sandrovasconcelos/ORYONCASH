import { fetchComTimeout } from "@/lib/fetchComTimeout";

// Fixo no codigo, sem ler de env var (uma env var GEMINI_MODEL obsoleta na
// Vercel ja anulou troca de modelo no passado).
//
// A disponibilidade dos modelos varia de minuto em minuto: em picos de
// demanda cada um responde 503 de forma independente (medido: num momento
// so os "lite" respondiam, minutos depois so alguns "flash"). Por isso a
// cadeia tem varios modelos - um 503 costuma voltar em <1s, entao trocar
// de modelo e barato; o que custa caro e um modelo que "pendura" ate o
// timeout, e por isso cada tentativa tem teto proprio.
const MODELOS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
];

const TIMEOUT_POR_TENTATIVA_MS = 15_000;

export async function chamarGemini(
  body: unknown,
  opcoes: { orcamentoMs: number; contexto: string }
): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  const corpo = JSON.stringify(body);
  const inicio = Date.now();
  let ultimoErro: unknown = null;

  // Ate 2 voltas na cadeia enquanto houver orcamento de tempo: um 503
  // geralmente passa em poucos segundos.
  for (let volta = 0; volta < 2; volta++) {
    for (const modelo of MODELOS) {
      const restante = opcoes.orcamentoMs - (Date.now() - inicio);
      if (restante < 3_000) {
        throw ultimoErro instanceof Error ? ultimoErro : new Error("Gemini: tempo esgotado");
      }

      try {
        const res = await fetchComTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo },
          Math.min(TIMEOUT_POR_TENTATIVA_MS, restante)
        );
        if (res.ok) return res;

        const texto = await res.text().catch(() => "");
        console.error(`Gemini (${modelo}) respondeu ${res.status} - ${opcoes.contexto}:`, texto.slice(0, 200));
        ultimoErro = new Error(`Falha ao chamar a API do Gemini (${res.status})`);
        // 4xx que nao seja 404/429 (ex: 400 arquivo invalido, 403 chave)
        // nao melhora trocando de modelo.
        if (res.status >= 400 && res.status < 500 && res.status !== 404 && res.status !== 429) {
          throw ultimoErro;
        }
      } catch (error) {
        if (error === ultimoErro) throw error;
        console.error(`Gemini (${modelo}) falhou - ${opcoes.contexto}:`, error);
        ultimoErro = error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw ultimoErro instanceof Error ? ultimoErro : new Error("Falha ao chamar a API do Gemini");
}
