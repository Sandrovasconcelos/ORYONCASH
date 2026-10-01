import type { InvoiceItem } from "./extractInvoice";

export type AjusteDesconto = {
  /** Soma dos itens como vieram da nota (preco de tabela). */
  valorItens: number;
  /** Valor final da nota - o que de fato foi/sera pago. */
  valorFinal: number;
  /** Diferenca (positiva = desconto; negativa = frete/acrescimo nao itemizado). */
  diferenca: number;
};

// Fora dessa faixa, a diferenca provavelmente e erro de leitura (Gemini leu o
// total errado), nao desconto/frete real - mais seguro nao criar um ajuste em
// cima de um numero suspeito do que lancar um valor estranho.
const RAZAO_MINIMA = 0.5;
const RAZAO_MAXIMA = 1.5;

/**
 * Quando a nota discrimina um total final diferente da soma dos itens (ex:
 * fornecedor deu desconto, ou cobrou frete nao itemizado), devolve os
 * detalhes desse ajuste. Os itens continuam sendo lancados com o preco de
 * tabela (igual na nota impressa, pra bater numa conferencia manual) - quem
 * chama usa o retorno aqui pra criar um lancamento SEPARADO com a diferenca,
 * em vez de alterar o valor de cada item (ver criarLancamentoDeAjusteDesconto
 * em lib/conversation/engine.ts).
 *
 * Null quando nao ha o que ajustar (total bate com a soma) ou quando a
 * diferenca foge demais da faixa razoavel de desconto/frete.
 */
export function detectarAjusteDesconto(
  itens: InvoiceItem[],
  valorTotalNota: number | null
): AjusteDesconto | null {
  if (!valorTotalNota || valorTotalNota <= 0 || itens.length === 0) return null;

  const valorItens = Math.round(itens.reduce((soma, item) => soma + item.valorTotal, 0) * 100) / 100;
  if (valorItens <= 0) return null;

  const diferenca = Math.round((valorItens - valorTotalNota) * 100) / 100;
  if (Math.abs(diferenca) < 0.01) return null;

  const razao = valorTotalNota / valorItens;
  if (razao < RAZAO_MINIMA || razao > RAZAO_MAXIMA) return null;

  return { valorItens, valorFinal: valorTotalNota, diferenca };
}
