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

/** Aceita 19/08, 19/08/26, 19/08/2026, hoje e ontem; devolve AAAA-MM-DD ou null. */
export function parseDataCorrecao(texto: string, hoje: string): string | null {
  const t = texto.trim().toLowerCase();
  if (t === "hoje") return hoje;
  if (t === "ontem") return new Date(Date.parse(`${hoje}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let ano = m[3] ? Number(m[3]) : Number(hoje.slice(0, 4));
  if (ano < 100) ano += 2000;
  const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== dia || d.getUTCMonth() + 1 !== mes) return null;
  return iso;
}

/**
 * Data lida de um comprovante de pagamento so vale se for uma data real, nao
 * futura e recente (ate 120 dias) - leitura errada nao pode mandar o
 * lancamento pra 2019. Devolve AAAA-MM-DD ou undefined.
 */
export function dataDePagamentoValida(iso: string | null | undefined, hoje: string): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const d = Date.parse(`${iso}T00:00:00Z`);
  const h = Date.parse(`${hoje}T00:00:00Z`);
  if (Number.isNaN(d) || d > h) return undefined;
  if (h - d > 120 * 86_400_000) return undefined;
  return iso;
}
