/**
 * Uma consulta `.in("coluna", [centenas de ids])` vira uma URL enorme: fica
 * lenta e, passando de certo tamanho, o servidor recusa. Parte os ids em
 * lotes pequenos e roda todos ao mesmo tempo, juntando o resultado.
 */
export const TAMANHO_LOTE_IDS = 80;

export function dividirEmLotes<T>(itens: T[], tamanho = TAMANHO_LOTE_IDS): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

type RespostaComErro<L> = { data: L[] | null; error: { code?: string; message: string } | null };

export async function consultarEmLotes<T, L = Record<string, unknown>>(
  ids: T[],
  consultar: (lote: T[]) => PromiseLike<RespostaComErro<L>>
): Promise<{ data: L[]; error: { code?: string; message: string } | null }> {
  if (ids.length === 0) return { data: [], error: null };
  const respostas = await Promise.all(dividirEmLotes(ids).map((lote) => consultar(lote)));
  return {
    data: respostas.flatMap((r) => r.data ?? []),
    error: respostas.find((r) => r.error)?.error ?? null,
  };
}
