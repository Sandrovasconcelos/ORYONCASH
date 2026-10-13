import { rotuloDaArea, type AreaArquivo } from "./tipos";

/** Onde o arquivo fica no Drive: OryonCash / <area> / <obra ou licitacao> / <tipo>. */
export function caminhoNoDrive(a: { area: AreaArquivo; pastaNome: string | null; tipo: string }): string[] {
  return [rotuloDaArea(a.area), a.pastaNome ?? (a.area === "obra" ? "Sem obra definida" : ""), a.tipo].filter(Boolean);
}
