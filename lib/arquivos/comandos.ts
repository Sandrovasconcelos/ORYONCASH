import { lerValidade } from "./validade";

export type Correcao =
  | { campo: "obra"; valor: string }
  | { campo: "licitacao"; valor: string }
  | { campo: "empresa"; valor: string | null }
  | { campo: "pessoal"; valor: string | null }
  | { campo: "tipo"; valor: string }
  | { campo: "nome"; valor: string }
  | { campo: "validade"; valor: string | null }
  | { campo: "excluir" };

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Le uma correcao escrita pela pessoa depois de guardar um arquivo:
 * "obra Aurora", "licitação Concorrência 04/2026", "tipo Licenças",
 * "vence 14/03/2027", "sem validade", "nome Alvará 2026", "excluir".
 * Devolve null quando nao entende (o bot explica os formatos).
 */
export function lerCorrecao(texto: string): Correcao | null {
  const original = texto.trim().replace(/\s+/g, " ");
  const t = semAcento(original);
  if (!t) return null;

  if (/^(excluir|apagar|deletar|remover|remove)\b/.test(t)) return { campo: "excluir" };
  if (/^sem (validade|prazo)/.test(t) || /^nao (tem validade|vence)/.test(t)) return { campo: "validade", valor: null };

  const resto = (prefixo: RegExp) => original.replace(new RegExp(prefixo.source, "i"), "").replace(/^[\s:,-]+/, "").trim();

  if (/^(vence|vencimento|validade|valido ate|vale ate)\b/.test(t)) {
    const lida = lerValidade(resto(/^(vence|vencimento|validade|v[aá]lido at[eé]|vale at[eé])\s*(em|dia|no dia|em)?/));
    return lida.ok ? { campo: "validade", valor: lida.data } : null;
  }
  if (/^obra\b/.test(t)) {
    const v = resto(/^obra/);
    return v ? { campo: "obra", valor: v } : null;
  }
  if (/^licitacao\b/.test(t)) {
    const v = resto(/^licita[cç][aã]o/);
    return v ? { campo: "licitacao", valor: v } : null;
  }
  if (/^empresa\b/.test(t)) return { campo: "empresa", valor: resto(/^empresa/) || null };
  if (/^pessoal\b/.test(t)) return { campo: "pessoal", valor: resto(/^pessoal/) || null };
  if (/^tipo\b/.test(t)) {
    const v = resto(/^tipo/);
    return v ? { campo: "tipo", valor: v } : null;
  }
  if (/^(nome|titulo)\b/.test(t)) {
    const v = resto(/^(nome|t[ií]tulo)/);
    return v ? { campo: "nome", valor: v } : null;
  }
  return null;
}

export const AJUDA_DE_CORRECAO =
  'Me diga o que mudar, por exemplo:\n• *obra Aurora*\n• *licitação Concorrência 04/2026*\n• *empresa* ou *pessoal*\n• *tipo Licenças*\n• *vence 14/03/2027* ou *sem validade*\n• *nome Alvará de construção*\n• *excluir*';
