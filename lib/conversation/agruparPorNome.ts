function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Etapas se repetem por obra com o mesmo nome ("ALVENARIA E VEDAÇÃO" existe
 * uma vez em cada obra). Pra pergunta tipo "quanto gastei com alvenaria"
 * somar todas, agrupa pelo nome e guarda todos os ids.
 */
export function agruparPorNome(itens: { id: string; nome: string }[]): { nome: string; ids: string[] }[] {
  const grupos = new Map<string, { nome: string; ids: string[] }>();
  for (const item of itens) {
    const chave = normalizar(item.nome);
    const existente = grupos.get(chave);
    if (existente) existente.ids.push(item.id);
    else grupos.set(chave, { nome: item.nome.replace(/\s+/g, " ").trim(), ids: [item.id] });
  }
  return [...grupos.values()];
}

/**
 * Todos os itens que casam com a pista: se algum tem exatamente esse nome,
 * so ele(s); senao, os que contem todas as palavras da pista. Quem chama
 * decide o que fazer com mais de um (somar ou perguntar qual). Com
 * exatoPrimeiro=false, o nome exato nao esconde os parecidos (usado em
 * material: "cimento" soma "CIMENTO TDS 50KG" tambem).
 */
export function candidatosPorPista<T extends { nome: string }>(
  itens: T[],
  pista: string,
  exatoPrimeiro = true
): T[] {
  const termo = normalizar(pista);
  const palavras = termo.split(/[^a-z0-9]+/).filter(Boolean);
  if (palavras.length === 0) return [];
  const exatos = itens.filter((i) => normalizar(i.nome) === termo);
  if (exatoPrimeiro && exatos.length > 0) return exatos;
  return itens.filter((i) => {
    const nome = normalizar(i.nome);
    return palavras.every((p) => nome.includes(p));
  });
}
