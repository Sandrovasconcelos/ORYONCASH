function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Palavras que identificam um documento (e nao uma conta a pagar).
const PALAVRAS_DE_DOCUMENTO =
  /\b(matricula|escritura|alvara|certidao|certidoes|contrato social|contrato|edital|proposta|habilitacao|licitacao|projeto|planta|memorial|habite-?se|art|rrt|registro|incorporacao|cnd|fgts|crf|cnh|rg|cpf|cnpj|procuracao|laudo|ata|estatuto|apolice|seguro|declaracao|atestado|acervo)\b/;

const PALAVRAS_DE_CONTA = /\b(boleto|fatura|nota|nf|nfe|nfce|danfe|cupom|recibo|comprovante|pix|ted|duplicata|orcamento)\b/;

/**
 * A legenda que acompanha o arquivo diz que e pra GUARDAR (e nao uma conta):
 * "guarda essa matricula", "alvara do Aurora", "arquivo: edital 04/2026".
 */
export function legendaPedeGuardar(legenda: string | null | undefined): boolean {
  const t = semAcento(legenda ?? "").trim();
  if (!t) return false;
  if (/\b(guarda|guardar|guarde|arquiva|arquivar|arquive|salva|salvar|salve)\b/.test(t) && !PALAVRAS_DE_CONTA.test(t)) return true;
  if (/\b(arquivo|documento)\b/.test(t) && !PALAVRAS_DE_CONTA.test(t)) return true;
  return PALAVRAS_DE_DOCUMENTO.test(t) && !PALAVRAS_DE_CONTA.test(t);
}

/** O nome do arquivo ja entrega o que ele e: "matricula_lote12.pdf" vs "boleto_luz.pdf". */
export function nomeDoArquivoSugere(nome: string | null | undefined): "documento" | "conta" | null {
  const t = semAcento(nome ?? "").replace(/\.[a-z0-9]{2,5}$/, "").replace(/[_.-]+/g, " ");
  if (!t.trim()) return null;
  // Nome de nota/boleto costuma vir colado em numeros: "nfe3519...", "boleto123".
  if (PALAVRAS_DE_CONTA.test(t) || /(^|[^a-z])(nfs?e?|nfce|danfe|boleto|fatura|cupom|recibo|comprovante)/.test(t) || /\d{30,}/.test(t)) {
    return "conta";
  }
  if (PALAVRAS_DE_DOCUMENTO.test(t)) return "documento";
  return null;
}

const VERBOS_DE_PEDIDO =
  /\b(manda|mande|mandar|envia|envie|enviar|me passa|me passe|passa|mostra|mostre|cade|onde (esta|ta|fica)|preciso d[aeo]s?|quero (ver )?(o|a|os|as)|pega|busca|procura|traz|abre)\b/;

const SUBSTANTIVOS_DE_ARQUIVO = new RegExp(`\\b(arquivos?|documentos?|pdf)\\b|${PALAVRAS_DE_DOCUMENTO.source}`);

/**
 * Pedido de um arquivo guardado: "manda a matricula do lote 12", "cade o
 * alvara do Aurora", "preciso do edital da concorrencia 04".
 */
export function pareceBuscaDeArquivo(texto: string): boolean {
  const t = semAcento(texto.trim());
  if (t.length < 6) return false;
  if (PALAVRAS_DE_CONTA.test(t) && !/\barquivo\b/.test(t)) return false;
  return VERBOS_DE_PEDIDO.test(t) && SUBSTANTIVOS_DE_ARQUIVO.test(t);
}

/** "quais documentos vencem esse mes", "certidoes vencendo". */
export function pareceConsultaDeVencimentos(texto: string): boolean {
  const t = semAcento(texto.trim());
  if (t.length < 8) return false;
  return /\b(documentos?|certidoes|certidao|arquivos?|alvaras?|licencas?)\b/.test(t) && /\b(vencendo|vencer|vencem|vence|vencidos?|vencidas?|a vencer|validade)\b/.test(t);
}
