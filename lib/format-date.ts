const TIME_ZONE_BRASIL = "America/Fortaleza";

export function formatDataHoraBrasil(iso: string, options?: { year?: boolean }) {
  const incluirAno = options?.year ?? true;
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: TIME_ZONE_BRASIL,
    day: "2-digit",
    month: "2-digit",
    ...(incluirAno ? { year: "2-digit" as const } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Datas sem hora ("2026-08-21", colunas date do banco) sao dia de calendario,
 * nao um instante: convertidas pelo fuso caem no dia anterior (meia-noite UTC
 * = 21h do dia 20 no Brasil). So timestamps completos passam pelo fuso.
 */
export function formatDataBrasil(iso: string) {
  const soData = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: TIME_ZONE_BRASIL,
  });
}
