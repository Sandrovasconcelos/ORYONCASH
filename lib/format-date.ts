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

export function formatDataBrasil(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: TIME_ZONE_BRASIL,
  });
}
