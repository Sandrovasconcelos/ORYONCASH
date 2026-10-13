export type AreaArquivo = "obra" | "licitacao" | "empresa" | "pessoal";

export const AREAS: { id: AreaArquivo; rotulo: string; icone: string; descricao: string }[] = [
  { id: "obra", rotulo: "Obras", icone: "🏗️", descricao: "Um conjunto de pastas por obra/empreendimento" },
  { id: "licitacao", rotulo: "Licitações", icone: "📑", descricao: "Uma pasta por licitação" },
  { id: "empresa", rotulo: "Empresa", icone: "🏢", descricao: "Contrato social, certidões da empresa" },
  { id: "pessoal", rotulo: "Pessoal", icone: "👤", descricao: "Documentos pessoais" },
];

export const TIPOS_SUGERIDOS: Record<AreaArquivo, string[]> = {
  obra: ["Terreno e matrícula", "Licenças", "Projetos", "Contratos", "Orçamentos", "Certidões", "Fotos", "Outros"],
  licitacao: ["Edital", "Proposta", "Habilitação", "Certidões", "Contratos", "Outros"],
  empresa: ["Certidões", "Contratos", "Licenças", "Orçamentos", "Outros"],
  pessoal: ["Identificação", "Contratos", "Orçamentos", "Outros"],
};

export const TIPO_PADRAO = "Outros";

export function ehArea(valor: string): valor is AreaArquivo {
  return valor === "obra" || valor === "licitacao" || valor === "empresa" || valor === "pessoal";
}

export function rotuloDaArea(area: AreaArquivo): string {
  return AREAS.find((a) => a.id === area)?.rotulo ?? area;
}

/** Todos os tipos conhecidos (sugeridos de todas as areas), sem repetir. */
export function todosOsTiposSugeridos(): string[] {
  return [...new Set(Object.values(TIPOS_SUGERIDOS).flat())];
}

/** "Obras › Residencial Aurora › Licenças" - o caminho de um arquivo. */
export function caminhoDoArquivo(a: { area: AreaArquivo; pastaNome: string | null; tipo: string }): string {
  return [rotuloDaArea(a.area), a.pastaNome, a.tipo].filter(Boolean).join(" › ");
}

/** Normaliza a escrita do tipo: aceita "licencas" e devolve "Licenças" quando for um tipo conhecido. */
export function normalizarTipo(texto: string): string {
  const limpo = texto.trim().replace(/\s+/g, " ");
  if (!limpo) return TIPO_PADRAO;
  const chave = semAcento(limpo);
  const conhecido = todosOsTiposSugeridos().find((t) => semAcento(t) === chave);
  if (conhecido) return conhecido;
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
