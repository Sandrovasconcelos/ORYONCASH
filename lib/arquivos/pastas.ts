import type { AreaArquivo } from "./tipos";
import { situacaoDaValidade } from "./validade";

export const PASTA_SEM_OBRA = "_sem";
export const PASTA_GERAL = "_geral";

export type ArquivoDePasta = {
  area: AreaArquivo;
  obra_id: string | null;
  obraNome: string | null;
  pasta: string | null;
  tipo: string;
  validade: string | null;
  avisar_dias_antes: number;
};

export type Pasta = {
  chave: string;
  nome: string;
  total: number;
  vencidos: number;
  vencendo: number;
};

/** Chave da pasta de um arquivo dentro da area (id da obra, ou o nome da licitacao/pasta). */
export function chaveDaPasta(a: Pick<ArquivoDePasta, "area" | "obra_id" | "pasta">): string {
  if (a.area === "obra") return a.obra_id ?? PASTA_SEM_OBRA;
  return a.pasta?.trim() || PASTA_GERAL;
}

export function nomeDaPasta(chave: string, a?: Pick<ArquivoDePasta, "area" | "obraNome">): string {
  if (chave === PASTA_SEM_OBRA) return "Sem obra definida";
  if (chave === PASTA_GERAL) return "Geral";
  return a?.area === "obra" ? (a.obraNome ?? chave) : chave;
}

function contar(arquivos: ArquivoDePasta[], hoje: string) {
  let vencidos = 0;
  let vencendo = 0;
  for (const a of arquivos) {
    const s = situacaoDaValidade(a.validade, hoje, a.avisar_dias_antes);
    if (s === "vencido") vencidos += 1;
    else if (s === "vencendo") vencendo += 1;
  }
  return { total: arquivos.length, vencidos, vencendo };
}

export function resumoDaArea(arquivos: ArquivoDePasta[], hoje: string) {
  return contar(arquivos, hoje);
}

/**
 * Pastas de uma area. Na area de obras, toda obra cadastrada aparece (mesmo
 * vazia) pra ficar facil mandar o primeiro arquivo dela.
 */
export function listarPastas(
  arquivosDaArea: ArquivoDePasta[],
  area: AreaArquivo,
  hoje: string,
  obras: { id: string; nome: string }[] = []
): Pasta[] {
  const grupos = new Map<string, { nome: string; itens: ArquivoDePasta[] }>();
  if (area === "obra") {
    for (const o of obras) grupos.set(o.id, { nome: o.nome, itens: [] });
  }
  for (const a of arquivosDaArea) {
    const chave = chaveDaPasta(a);
    const grupo = grupos.get(chave) ?? { nome: nomeDaPasta(chave, a), itens: [] };
    grupo.itens.push(a);
    grupos.set(chave, grupo);
  }
  return [...grupos.entries()]
    .map(([chave, g]) => ({ chave, nome: g.nome, ...contar(g.itens, hoje) }))
    .sort((x, y) => {
      if (x.chave === PASTA_SEM_OBRA || x.chave === PASTA_GERAL) return 1;
      if (y.chave === PASTA_SEM_OBRA || y.chave === PASTA_GERAL) return -1;
      return x.nome.localeCompare(y.nome, "pt-BR");
    });
}

/** Subpastas por tipo dentro de uma pasta. */
export function listarTipos(arquivosDaPasta: ArquivoDePasta[], hoje: string): Pasta[] {
  const grupos = new Map<string, ArquivoDePasta[]>();
  for (const a of arquivosDaPasta) {
    const lista = grupos.get(a.tipo) ?? [];
    lista.push(a);
    grupos.set(a.tipo, lista);
  }
  return [...grupos.entries()]
    .map(([tipo, itens]) => ({ chave: tipo, nome: tipo, ...contar(itens, hoje) }))
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}
