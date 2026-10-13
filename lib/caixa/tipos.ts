export type ClassificacaoCaixa =
  | "venda"
  | "aporte"
  | "rendimento"
  | "outra_entrada"
  | "resgate"
  | "aplicacao"
  | "outra_saida";

export type DirecaoCaixa = "entrada" | "saida";

export const CLASSIFICACOES: { id: ClassificacaoCaixa; rotulo: string; direcao: DirecaoCaixa; transferencia: boolean; ajuda: string }[] = [
  { id: "venda", rotulo: "Venda (parcela de cliente)", direcao: "entrada", transferencia: false, ajuda: "Pagamento de um cliente que comprou uma casa" },
  { id: "aporte", rotulo: "Aporte de sócio", direcao: "entrada", transferencia: false, ajuda: "Dinheiro que um sócio colocou na empresa" },
  { id: "rendimento", rotulo: "Rendimento", direcao: "entrada", transferencia: false, ajuda: "Rendimento do investimento" },
  { id: "outra_entrada", rotulo: "Outra entrada", direcao: "entrada", transferencia: false, ajuda: "Qualquer outro dinheiro que entrou" },
  { id: "resgate", rotulo: "Resgate do investimento", direcao: "entrada", transferencia: true, ajuda: "Dinheiro que voltou do investimento (não é receita)" },
  { id: "aplicacao", rotulo: "Aplicação no investimento", direcao: "saida", transferencia: true, ajuda: "Dinheiro que foi pro investimento (não é despesa)" },
  { id: "outra_saida", rotulo: "Outra saída", direcao: "saida", transferencia: false, ajuda: "Saída que não é despesa de obra (retirada de sócio, imposto...)" },
];

export function ehClassificacao(valor: string | null | undefined): valor is ClassificacaoCaixa {
  return CLASSIFICACOES.some((c) => c.id === valor);
}

export function rotuloDaClassificacao(id: ClassificacaoCaixa | null | undefined): string {
  return CLASSIFICACOES.find((c) => c.id === id)?.rotulo ?? "Sem classificação";
}

/** Rotulo curto pra etiqueta na tabela. */
export function rotuloCurto(id: ClassificacaoCaixa | null | undefined): string {
  switch (id) {
    case "venda":
      return "Venda";
    case "aporte":
      return "Aporte";
    case "rendimento":
      return "Rendimento";
    case "outra_entrada":
      return "Outra entrada";
    case "resgate":
      return "Resgate";
    case "aplicacao":
      return "Aplicação";
    case "outra_saida":
      return "Outra saída";
    default:
      return "Sem classificação";
  }
}

export function ehTransferencia(id: ClassificacaoCaixa | null | undefined): boolean {
  return CLASSIFICACOES.find((c) => c.id === id)?.transferencia ?? false;
}

/** Opcoes que fazem sentido pra uma transacao do extrato (credito = entrada, debito = saida). */
export function classificacoesDoTipo(tipo: "credito" | "debito") {
  const direcao: DirecaoCaixa = tipo === "credito" ? "entrada" : "saida";
  return CLASSIFICACOES.filter((c) => c.direcao === direcao);
}
