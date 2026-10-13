import type { ClassificacaoCaixa } from "./tipos";

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Reconhece pelo texto do extrato o que da pra saber sem perguntar:
 * resgate, rendimento e aplicacao financeira. O resto (venda, aporte...)
 * o dono classifica - e o sistema aprende pela regra do beneficiario.
 */
export function classificarAutomaticamente(descricao: string | null | undefined, tipo: "credito" | "debito"): ClassificacaoCaixa | null {
  const t = semAcento(descricao ?? "");
  if (!t.trim()) return null;
  if (tipo === "credito") {
    if (/\b(resgate|resg\.?)\b/.test(t)) return "resgate";
    if (/\b(rendiment|rend\.? aplic|juros s\/ aplic)/.test(t)) return "rendimento";
    return null;
  }
  if (/\b(aplicacao|aplic\.?\s+fdo|aplic\.?\s+auto|cdb|poupanca|fundo\s+de\s+invest)/.test(t)) return "aplicacao";
  return null;
}
