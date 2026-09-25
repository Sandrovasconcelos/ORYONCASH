/**
 * Movimentacoes que saem da conta mas nao sao despesa de obra (aplicacao em
 * fundo, resgate, CDB, poupanca). Entram no extrato ja como "ignorado" - sem
 * isso um unico "APLICACAO FDO" de R$ 1 mi polui a lista de pendencias.
 * Tarifas ficam de fora de proposito: sao gasto real e o dono decide.
 */
const MOVIMENTO_FINANCEIRO =
  /\b(aplica[cç][aã]o|aplic\.?\s+fdo|resgate|resg\.?\s|cdb|poupan[cç]a|fundo\s+de\s+invest)/i;

export function ehMovimentoFinanceiro(descricao: string | null | undefined): boolean {
  return MOVIMENTO_FINANCEIRO.test(descricao ?? "");
}

/**
 * O extrato descreve o pagamento assim: "DEB PIX QR COD DIN - Marsol
 * Distribuido", "ENVIO DE TED - Ivana C S Barbosa". O nome de quem recebeu
 * vem depois do ultimo " - ".
 */
export function nomeDoBeneficiario(descricao: string | null | undefined): string | null {
  const texto = (descricao ?? "").trim();
  const i = texto.lastIndexOf(" - ");
  if (i < 0) return null;
  const nome = texto.slice(i + 3).trim();
  return nome.length >= 3 ? nome : null;
}
