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

  return parearGruposDeMesmoValor(transacoesDebito, despesas, despesasDisponiveis, resultado);
}

const JANELA_DIAS_GRUPO = 7;

const centavos = (valor: number) => Math.round(valor * 100);

/**
 * Segunda passada: varios pagamentos de mesmo valor (ex: 6 PIX de R$ 3.690
 * no mesmo dia) travam a primeira passada por ambiguidade. Quando sobram
 * exatamente tantas transacoes quanto despesas com aquele valor (todas
 * dentro de uma janela maior), o casamento e inequivoco no dinheiro - so
 * pode trocar a ordem entre itens identicos - entao pareia por ordem de data.
 * Se o numero nao bate (falta ou sobra um lancamento), continua manual.
 */
function parearGruposDeMesmoValor(
  transacoesDebito: TransacaoParaCasar[],
  despesas: DespesaParaCasar[],
  despesasDisponiveis: Set<string>,
  resultado: Map<string, string>
): Map<string, string> {
  const transacoesPorValor = new Map<number, TransacaoParaCasar[]>();
  for (const t of transacoesDebito) {
    if (resultado.has(t.id)) continue;
    const chave = centavos(t.valor);
    transacoesPorValor.set(chave, [...(transacoesPorValor.get(chave) ?? []), t]);
  }

  for (const [chave, grupoT] of transacoesPorValor) {
    const grupoD = despesas
      .filter((d) => despesasDisponiveis.has(d.id) && Math.abs(centavos(d.valor) - chave) <= 1)
      .sort((a, b) => a.data.localeCompare(b.data));
    if (grupoT.length < 2 || grupoT.length !== grupoD.length) continue;

    const pares = grupoT.map((t, i) => ({ t, d: grupoD[i] }));
    if (!pares.every(({ t, d }) => diffDias(t.data, d.data) <= JANELA_DIAS_GRUPO)) continue;
    for (const { t, d } of pares) {
      resultado.set(t.id, d.id);
      despesasDisponiveis.delete(d.id);
    }
  }

  return resultado;
}
