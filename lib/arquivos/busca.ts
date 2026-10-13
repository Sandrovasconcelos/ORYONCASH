export type ArquivoBuscavel = {
  id: string;
  nome: string;
  tipo: string;
  area: string;
  pastaNome: string | null;
  descricao: string | null;
  nomeArquivo: string | null;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Palavras do pedido que nao ajudam a achar o arquivo.
const PALAVRAS_VAZIAS = new Set([
  "manda", "mande", "mandar", "envia", "envie", "enviar", "me", "passa", "passe", "mostra", "mostre", "cade",
  "onde", "esta", "ta", "fica", "preciso", "quero", "ver", "pega", "busca", "procura", "traz", "abre",
  "o", "a", "os", "as", "um", "uma", "do", "da", "dos", "das", "de", "no", "na", "nos", "nas", "pra", "para",
  "por", "favor", "esse", "essa", "aquele", "aquela", "meu", "minha", "arquivo", "arquivos", "documento",
  "documentos", "pdf", "ai", "aqui", "agora", "e", "que", "com", "em",
]);

export function palavrasDoPedido(pedido: string): string[] {
  return normalizar(pedido)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 1 && !PALAVRAS_VAZIAS.has(p));
}

function contem(haystack: string, palavra: string): boolean {
  if (/^\d+$/.test(palavra)) return new RegExp(`(^|[^0-9])${palavra}([^0-9]|$)`).test(haystack);
  if (haystack.includes(palavra)) return true;
  // plural/singular: "certidoes" x "certidao", "licencas" x "licenca"
  if (palavra.length >= 5 && palavra.endsWith("s")) return haystack.includes(palavra.slice(0, -1));
  if (palavra.length >= 5 && palavra.endsWith("oes")) return haystack.includes(`${palavra.slice(0, -3)}ao`);
  return false;
}

export type ResultadoBusca = {
  /** Arquivos que casam com TODAS as palavras do pedido. */
  exatos: ArquivoBuscavel[];
  /** Os que casam com so parte das palavras (melhores primeiro). */
  parecidos: ArquivoBuscavel[];
  palavras: string[];
};

export function buscarArquivos(arquivos: ArquivoBuscavel[], pedido: string): ResultadoBusca {
  const palavras = palavrasDoPedido(pedido);
  if (palavras.length === 0) return { exatos: [], parecidos: [], palavras };

  const pontuados = arquivos
    .map((a) => {
      const haystack = normalizar([a.nome, a.tipo, a.pastaNome, a.descricao, a.nomeArquivo].filter(Boolean).join(" "));
      const area = normalizar(a.area);
      const pontos = palavras.filter((p) => contem(haystack, p) || contem(area, p)).length;
      return { a, pontos };
    })
    .filter((x) => x.pontos > 0)
    .sort((x, y) => y.pontos - x.pontos);

  const exatos = pontuados.filter((x) => x.pontos === palavras.length).map((x) => x.a);
  const parecidos = pontuados.filter((x) => x.pontos < palavras.length).map((x) => x.a);
  return { exatos, parecidos, palavras };
}
