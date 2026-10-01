import type { InvoiceItem } from "./extractInvoice";

export type AjusteDesconto = {
  /** Soma dos itens como veio da nota, antes do ajuste. */
  valorItens: number;
  /** Valor final da nota (o que foi/sera pago) - o novo total dos itens. */
  valorFinal: number;
  /** Diferenca (positiva = desconto; negativa = frete/acrescimo nao itemizado). */
  diferenca: number;
};

// Fora dessa faixa, a diferenca provavelmente e erro de leitura (Gemini leu o
// total errado), nao desconto/frete real - mais seguro manter os itens como
// vieram do que distorcer tudo com base num numero suspeito.
const RAZAO_MINIMA = 0.5;
const RAZAO_MAXIMA = 1.5;

/**
 * Quando a nota discrimina um total final diferente da soma dos itens (ex:
 * fornecedor deu desconto, ou cobrou frete nao itemizado), rateia essa
 * diferenca proporcionalmente entre os itens - assim a soma dos lancamentos
 * bate com o que de fato foi pago (o que aparece no comprovante/PIX), em vez
 * de sempre lancar o preco de tabela. Sem isso, cada nota com desconto
 * inflava o total gasto da obra pelo valor do desconto.
 *
 * Devolve os itens ajustados (ou os originais, se nao houver o que ajustar)
 * e os detalhes do ajuste pra mostrar claramente pra quem esta lancando.
 */
export function rateiarDescontoNosItens(
  itens: InvoiceItem[],
  valorTotalNota: number | null
): { itens: InvoiceItem[]; ajuste: AjusteDesconto | null } {
  if (!valorTotalNota || valorTotalNota <= 0 || itens.length === 0) {
    return { itens, ajuste: null };
  }

  const valorItens = Math.round(itens.reduce((soma, item) => soma + item.valorTotal, 0) * 100) / 100;
  if (valorItens <= 0) return { itens, ajuste: null };

  const diferenca = Math.round((valorItens - valorTotalNota) * 100) / 100;
  if (Math.abs(diferenca) < 0.01) return { itens, ajuste: null };

  const razao = valorTotalNota / valorItens;
  if (razao < RAZAO_MINIMA || razao > RAZAO_MAXIMA) {
    return { itens, ajuste: null };
  }

  const ajustados = itens.map((item) => {
    const novoTotal = Math.round(item.valorTotal * razao * 100) / 100;
    return {
      ...item,
      valorTotal: novoTotal,
      valorUnitario: item.quantidade > 0 ? Math.round((novoTotal / item.quantidade) * 100) / 100 : item.valorUnitario,
    };
  });

  // Arredondar item a item costuma deixar a soma uns centavos longe do total
  // real - absorve a sobra no ultimo item pra bater exatamente.
  const somaAjustada = ajustados.reduce((soma, item) => soma + item.valorTotal, 0);
  const sobra = Math.round((valorTotalNota - somaAjustada) * 100) / 100;
  if (Math.abs(sobra) >= 0.01 && ajustados.length > 0) {
    const ultimo = ajustados[ajustados.length - 1];
    ultimo.valorTotal = Math.round((ultimo.valorTotal + sobra) * 100) / 100;
    if (ultimo.quantidade > 0) {
      ultimo.valorUnitario = Math.round((ultimo.valorTotal / ultimo.quantidade) * 100) / 100;
    }
  }

  return { itens: ajustados, ajuste: { valorItens, valorFinal: valorTotalNota, diferenca } };
}
