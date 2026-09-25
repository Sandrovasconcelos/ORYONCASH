// Fixo no codigo, sem ler de env var (uma env var GEMINI_MODEL obsoleta na
// Vercel ja anulou troca de modelo no passado).
//
// A disponibilidade dos modelos varia de minuto em minuto: em picos de
// demanda cada um responde 503 de forma independente, e alguns simplesmente
// "penduram" sem responder nem dar erro (medido: gemini-3.5-flash segurou a
// conexao por 15s inteiros). Tentar um modelo por vez custa 7-15s por
// modelo ruim e estoura o orcamento de tempo antes de chegar num que
// funciona - foi o que fez o bot cair no "nao consegui ler" mesmo com
// varios modelos saudaveis disponiveis.
//
// Por isso as tentativas correm em paralelo ("hedging"): dispara o melhor
// modelo; se ele falhar OU demorar alem de HEDGE_MS, dispara o proximo sem
// esperar o anterior terminar. Vence a primeira resposta boa e as outras
// sao canceladas. Falha rapida (503/erro de rede) dispara o proximo na hora.
const MODELOS = [
  // Intercala familias (flash / preview / lite): quando uma esta sobrecarregada
  // costuma ser porque a familia toda esta - os 2 primeiros disparam juntos.
  "gemini-3.6-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  // Geracao anterior: costuma ter folga de capacidade quando a nova esta
  // sobrecarregada.
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
];

// O Gemini leva ~6s pra devolver um 503, entao esperar a falha nao basta: os
// 2 primeiros modelos disparam juntos e a cada HEDGE_MS entra mais um.
const INICIAIS_EM_PARALELO = 2;
const MAX_EM_VOO = 4;
const HEDGE_PADRAO_MS = 4_000;
const TIMEOUT_POR_TENTATIVA_MS = 30_000;
// Modelo que falhou nos ultimos 2 min (sem nenhum sucesso depois) vai pro
// fim da fila - volta sozinho a ordem normal depois disso.
const QUARENTENA_MS = 2 * 60_000;

type Saude = { ultimaFalhaEm: number; ultimoOkEm: number };
const saudePorModelo = new Map<string, Saude>();

function registrar(modelo: string, ok: boolean) {
  const atual = saudePorModelo.get(modelo) ?? { ultimaFalhaEm: 0, ultimoOkEm: 0 };
  if (ok) atual.ultimoOkEm = Date.now();
  else atual.ultimaFalhaEm = Date.now();
  saudePorModelo.set(modelo, atual);
}

export function ordemDosModelos(agora = Date.now()): string[] {
  const emQuarentena = (m: string) => {
    const s = saudePorModelo.get(m);
    return !!s && s.ultimaFalhaEm > s.ultimoOkEm && agora - s.ultimaFalhaEm < QUARENTENA_MS;
  };
  return [...MODELOS.filter((m) => !emQuarentena(m)), ...MODELOS.filter(emQuarentena)];
}

export async function chamarGemini(
  body: unknown,
  opcoes: { orcamentoMs: number; contexto: string; hedgeMs?: number }
): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  const corpo = JSON.stringify(body);
  const ordem = ordemDosModelos();
  const hedgeMs = opcoes.hedgeMs ?? HEDGE_PADRAO_MS;

  return new Promise<Response>((resolve, reject) => {
    let proximo = 0;
    let emVoo = 0;
    let encerrado = false;
    let errosFatais = 0;
    let ultimoErro: Error | null = null;
    const controllers = new Set<AbortController>();
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function encerrar() {
      encerrado = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
    }

    function falhar(erro?: Error) {
      if (encerrado) return;
      encerrar();
      for (const c of controllers) c.abort();
      reject(erro ?? ultimoErro ?? new Error("Falha ao chamar a API do Gemini"));
    }

    function lancar() {
      if (encerrado) return;
      if (proximo >= ordem.length) {
        if (emVoo === 0) falhar();
        return;
      }

      const modelo = ordem[proximo++];
      const controller = new AbortController();
      controllers.add(controller);
      emVoo++;
      const inicioTentativa = Date.now();

      const timeoutTentativa = setTimeout(() => controller.abort(), TIMEOUT_POR_TENTATIVA_MS);
      timers.add(timeoutTentativa);

      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: corpo,
          signal: controller.signal,
        }
      )
        .then(async (res) => {
          if (encerrado) return;
          if (res.ok) {
            registrar(modelo, true);
            encerrar(); // limpa os timers, inclusive o desta tentativa (ela ainda vai ler o corpo)
            for (const c of controllers) if (c !== controller) c.abort();
            console.log(
              `Gemini (${modelo}) respondeu em ${Date.now() - inicioTentativa}ms - ${opcoes.contexto}`
            );
            resolve(res);
            return;
          }

          const texto = await res.text().catch(() => "");
          console.error(`Gemini (${modelo}) respondeu ${res.status} - ${opcoes.contexto}:`, texto.slice(0, 200));
          ultimoErro = new Error(`Falha ao chamar a API do Gemini (${res.status})`);
          registrar(modelo, false);

          // Chave invalida/sem permissao nao melhora trocando de modelo.
          if (res.status === 401 || res.status === 403) {
            falhar(ultimoErro);
            return;
          }
          // 400 pode ser problema do arquivo (vale pra todos) ou do modelo
          // (schema nao suportado): so desiste depois de 2 modelos recusarem.
          if (res.status === 400 && ++errosFatais >= 2) {
            falhar(ultimoErro);
          }
        })
        .catch((error) => {
          if (encerrado) return;
          console.error(`Gemini (${modelo}) falhou apos ${Date.now() - inicioTentativa}ms - ${opcoes.contexto}:`, error);
          ultimoErro = error instanceof Error ? error : new Error(String(error));
          registrar(modelo, false);
        })
        .finally(() => {
          clearTimeout(timeoutTentativa);
          timers.delete(timeoutTentativa);
          emVoo--;
          // Falhou (nao venceu): dispara o proximo modelo na hora.
          if (!encerrado) lancar();
        });
    }

    function agendarHedge() {
      const t = setTimeout(() => {
        timers.delete(t);
        if (encerrado) return;
        if (emVoo < MAX_EM_VOO && proximo < ordem.length) lancar();
        agendarHedge();
      }, hedgeMs);
      timers.add(t);
    }

    const orcamento = setTimeout(
      () => falhar(ultimoErro ?? new Error("Gemini: tempo esgotado")),
      opcoes.orcamentoMs
    );
    timers.add(orcamento);

    for (let i = 0; i < INICIAIS_EM_PARALELO; i++) lancar();
    agendarHedge();
  });
}
