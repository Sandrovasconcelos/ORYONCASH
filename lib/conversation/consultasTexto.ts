import { formatBRL } from "./format";

export function percentualDoOrcamento(gasto: number, orcado: number): number {
  if (!(orcado > 0)) return 0;
  return Math.round((gasto / orcado) * 100);
}

/** Frase final do comparativo: quanto a mais/a menos e em %. */
export function descreverVariacao(atual: number, anterior: number): string {
  const diferenca = Math.round((atual - anterior) * 100) / 100;
  if (Math.abs(diferenca) < 0.01) return "➡️ Gasto igual nos dois períodos.";
  if (anterior <= 0) return `📈 Gastou ${formatBRL(diferenca)} a mais (no período anterior não houve gasto).`;
  const pct = Math.round((Math.abs(diferenca) / anterior) * 100);
  return diferenca > 0
    ? `📈 Gastou *${formatBRL(diferenca)} a mais* (+${pct}%).`
    : `📉 Gastou *${formatBRL(-diferenca)} a menos* (-${pct}%).`;
}
