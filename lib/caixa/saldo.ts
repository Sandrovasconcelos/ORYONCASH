/** Le um saldo escrito em reais ("1.234,56", "-500", "R$ 0,00"). Aceita zero e negativo (conta no vermelho). */
export function lerSaldoBR(texto: string): number | null {
  const limpo = texto
    .replace(/r\$/gi, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (limpo === "" || limpo === "-") return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor)) return null;
  return Math.round(valor * 100) / 100;
}
