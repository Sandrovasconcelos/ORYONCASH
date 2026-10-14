import type { AreaArquivo } from "./tipos";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Primeira regra que casar vence. A ordem importa: "guia de tributos do alvara" e uma guia, nao um alvara.
const REGRAS_DE_TIPO: [RegExp, string][] = [
  [/\b(guias?|tributos?|multas?|taxas?|iss|iptu|impostos?|darf|dam)\b/, "Guias e taxas"],
  [/\b(matriculas?|escrituras?|terrenos?|registro de imoveis)\b/, "Terreno e matrícula"],
  [/\b(alvaras?|licencas?|habite-?se|licenciamento|art|rrt)\b/, "Licenças"],
  [/\b(projetos?|plantas?|memorial|desenhos?|dwg)\b/, "Projetos"],
  [/\b(orcamentos?|cotacao|cotacoes)\b/, "Orçamentos"],
  [/\b(contratos?|aditivos?|distratos?)\b/, "Contratos"],
  [/\b(certidao|certidoes|cnd|crf)\b/, "Certidões"],
  [/\b(fotos?|imagens?)\b/, "Fotos"],
  [/\bedital\b/, "Edital"],
  [/\bhabilitacao\b/, "Habilitação"],
];

/** O tipo que a propria legenda diz (ex: "guia de tributos" -> Guias e taxas). Null se nao diz. */
export function tipoDaLegenda(legenda: string | null | undefined): string | null {
  const t = normalizar(legenda ?? "");
  if (!t.trim()) return null;
  return REGRAS_DE_TIPO.find(([regra]) => regra.test(t))?.[1] ?? null;
}

/** A area que a legenda cita explicitamente (pessoal, licitacao, empresa). */
export function areaDaLegenda(legenda: string | null | undefined): AreaArquivo | null {
  const t = normalizar(legenda ?? "");
  if (/\bpessoal\b/.test(t)) return "pessoal";
  if (/\b(licitacao|licitacoes|concorrencia|pregao|tomada de precos)\b/.test(t)) return "licitacao";
  if (/\bda empresa\b|\bempresa:/.test(t)) return "empresa";
  return null;
}

export type ObraDaLegenda =
  | { tipo: "obra"; obra: { id: string; nome: string } }
  | { tipo: "ambiguo"; opcoes: { id: string; nome: string }[] };

/**
 * Qual obra cadastrada a legenda cita. Todas as palavras do nome (sem o
 * numero na frente) precisam aparecer. Quando mais de uma obra tem o mesmo
 * nome ("01 COSTA AMALFITANA", "02 Costa Amalfitana"), o numero da legenda
 * ("fase 02") desempata. Sem desempate possivel, devolve "ambiguo" - quem
 * chama pergunta, em vez de adivinhar.
 */
export function obraDaLegenda(legenda: string | null | undefined, obras: { id: string; nome: string }[]): ObraDaLegenda | null {
  const tokens = normalizar(legenda ?? "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const candidatas = obras.filter((o) => {
    const palavras = normalizar(o.nome)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 3 && !/^\d+$/.test(p));
    return palavras.length > 0 && palavras.every((p) => tokens.includes(p));
  });
  if (candidatas.length === 0) return null;
  if (candidatas.length === 1) return { tipo: "obra", obra: candidatas[0] };

  const numeros = tokens.filter((t) => /^\d{1,3}$/.test(t)).map(Number);
  const pelaNumeracao = candidatas.filter((o) => {
    const prefixo = normalizar(o.nome).match(/^\s*(\d{1,3})\b/);
    return prefixo !== null && numeros.includes(Number(prefixo[1]));
  });
  if (pelaNumeracao.length === 1) return { tipo: "obra", obra: pelaNumeracao[0] };
  return { tipo: "ambiguo", opcoes: pelaNumeracao.length > 1 ? pelaNumeracao : candidatas };
}
