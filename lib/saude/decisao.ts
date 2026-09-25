export type EstadoAnterior = { ok: boolean; ultimo_aviso_em: string | null } | null;
export type Aviso = "problema" | "recuperado" | "lembrete";

// Enquanto o problema persiste, lembra de novo a cada 3 dias (o dono ja sabe;
// so nao pode esquecer que continua fora do ar).
export const INTERVALO_LEMBRETE_MS = 72 * 60 * 60 * 1000;

/**
 * Decide se uma checagem gera aviso. Regra: avisa na mudanca de estado
 * (caiu / voltou) e faz lembrete espacado enquanto continuar com problema.
 * Primeira checagem de um canal saudavel nao avisa nada.
 */
export function decidirAviso(anterior: EstadoAnterior, okAgora: boolean, agora: number): Aviso | null {
  if (!anterior) return okAgora ? null : "problema";
  if (anterior.ok && !okAgora) return "problema";
  if (!anterior.ok && okAgora) return "recuperado";
  if (!anterior.ok && !okAgora) {
    const ultimo = anterior.ultimo_aviso_em ? Date.parse(anterior.ultimo_aviso_em) : 0;
    return agora - ultimo >= INTERVALO_LEMBRETE_MS ? "lembrete" : null;
  }
  return null;
}
