/**
 * A tela de Lançamentos manda, escondido no formulário, a própria URL (com
 * filtros e página) pra a ação voltar pra lá depois de salvar. Só aceita a
 * lista de lançamentos - qualquer outro valor cai no destino padrão (evita
 * redirecionar pra fora do app com um campo adulterado).
 */
export function destinoDeVolta(bruto: string, padrao: string): string {
  const valido = /^\/dashboard\/despesas(\?[A-Za-z0-9=&%._~+-]*)?$/.test(bruto);
  return valido ? bruto : padrao;
}
