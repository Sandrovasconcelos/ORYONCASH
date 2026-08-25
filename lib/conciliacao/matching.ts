export type TransacaoParaCasar = {
  id: string;
  data: string;
  valor: number;
  tipo: "debito" | "credito";
};

export type DespesaParaCasar = {
  id: string;
  data: string;
  valor: number;
};

const TOLERANCIA_VALOR = 0.01;
const JANELA_DIAS = 3;

function diffDias(dataA: string, dataB: string): number {
  const a = new Date(`${dataA}T00:00:00Z`).getTime();
  const b = new Date(`${dataB}T00:00:00Z`).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

/**
 * So tenta casar transacoes de debito (saida de dinheiro) com despesas -
 * credito (entrada) nao tem despesa correspondente por definicao. Casamento
 * automatico so quando existe exatamente UMA despesa candidata dentro da
 * tolerancia de valor+data (ambiguidade fica pra revisao manual, nunca
 * escolhe "o mais proximo" sozinho porque isso pode ligar a despesa errada
 * silenciosamente).
 */
export function casarTransacoes(
  transacoes: TransacaoParaCasar[],
  despesas: DespesaParaCasar[]
): Map<string, string> {
  const despesasDisponiveis = new Set(despesas.map((d) => d.id));
  const resultado = new Map<string, string>();

  const transacoesDebito = transacoes
    .filter((t) => t.tipo === "debito")
    .sort((a, b) => a.data.localeCompare(b.data));

  for (const transacao of transacoesDebito) {
    const candidatas = despesas.filter(
      (d) =>
        despesasDisponiveis.has(d.id) &&
        Math.abs(d.valor - transacao.valor) <= TOLERANCIA_VALOR &&
        diffDias(d.data, transacao.data) <= JANELA_DIAS
    );

    if (candidatas.length !== 1) continue;

    const escolhida = candidatas[0];
    resultado.set(transacao.id, escolhida.id);
    despesasDisponiveis.delete(escolhida.id);
  }

  return resultado;
}
