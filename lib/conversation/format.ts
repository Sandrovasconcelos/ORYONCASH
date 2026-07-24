/**
 * Aceita formatos comuns digitados no WhatsApp: "500", "500,00", "R$ 500,00",
 * "1.200,50". Retorna null se nao conseguir interpretar como numero > 0.
 */
export function parseValorBR(text: string): number | null {
  const limpo = text
    .replace(/r\$/gi, "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return Math.round(valor * 100) / 100;
}

export function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
