import { candidatosPorPista } from "@/lib/conversation/agruparPorNome";

/** "Villa Borghese", "vila borghese" e "VILA BORGHESE" viram a mesma chave. */
export function chaveDeNome(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/([a-z])\1+/g, "$1");
}

export type DestinoDeObra =
  | { tipo: "obra"; obraId: string; nome: string }
  | { tipo: "projeto"; pasta: string; nova: boolean }
  | { tipo: "ambiguo"; opcoes: string[] };

function capitalizar(texto: string): string {
  const limpo = texto.trim().replace(/\s+/g, " ");
  return limpo
    .split(" ")
    .map((p) => (p.length > 2 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/**
 * Onde guardar um arquivo que cita uma obra/empreendimento:
 *  1. e uma obra cadastrada (mesmo escrita diferente)? usa ela;
 *  2. e uma pasta de projeto que ja existe (projeto sem obra no financeiro)? reaproveita;
 *  3. senao, cria uma pasta de projeto nova - sem poluir as obras do financeiro.
 */
export function resolverDestinoDeObra(
  nome: string,
  obras: { id: string; nome: string }[],
  projetosExistentes: string[]
): DestinoDeObra {
  const chave = chaveDeNome(nome);
  if (!chave) return { tipo: "projeto", pasta: "Sem nome", nova: true };

  const igual = obras.filter((o) => chaveDeNome(o.nome) === chave);
  if (igual.length === 1) return { tipo: "obra", obraId: igual[0].id, nome: igual[0].nome };

  const porPalavras = igual.length > 1 ? igual : candidatosPorPista(obras, nome);
  if (porPalavras.length === 1) return { tipo: "obra", obraId: porPalavras[0].id, nome: porPalavras[0].nome };
  if (porPalavras.length > 1) return { tipo: "ambiguo", opcoes: porPalavras.map((o) => o.nome) };

  const existente = projetosExistentes.find((p) => chaveDeNome(p) === chave);
  if (existente) return { tipo: "projeto", pasta: existente, nova: false };
  const parecido = candidatosPorPista(projetosExistentes.map((p) => ({ nome: p })), nome);
  if (parecido.length === 1) return { tipo: "projeto", pasta: parecido[0].nome, nova: false };

  return { tipo: "projeto", pasta: capitalizar(nome).slice(0, 80), nova: true };
}
