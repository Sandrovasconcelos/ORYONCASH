/**
 * Datas da agenda. O fuso do Brasil usado no app (America/Fortaleza) e fixo
 * UTC-3, sem horario de verao - entao da pra converter com deslocamento fixo,
 * sem depender de bibliotecas de fuso.
 */

const DESLOCAMENTO_HORAS = 3;
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const ehData = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const ehHora = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function partes(data: string): [number, number, number] {
  const [a, m, d] = data.split("-").map(Number);
  return [a, m, d];
}

function valida(data: string): boolean {
  if (!ehData(data)) return false;
  const [a, m, d] = partes(data);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** "2026-10-15" + "15:00" (horario de Brasilia) -> instante real. Null se invalido. */
export function paraInstante(data: string, hora: string): Date | null {
  if (!valida(data) || !ehHora(hora)) return null;
  const [a, m, d] = partes(data);
  const [h, min] = hora.split(":").map(Number);
  return new Date(Date.UTC(a, m - 1, d, h + DESLOCAMENTO_HORAS, min));
}

function emBrasilia(instante: Date): Date {
  return new Date(instante.getTime() - DESLOCAMENTO_HORAS * 3_600_000);
}

export function dataLocalDe(instante: Date): string {
  return emBrasilia(instante).toISOString().slice(0, 10);
}

/** "qui 15/10 às 15:00" */
export function formatarInstante(instante: Date): string {
  const l = emBrasilia(instante);
  const dd = String(l.getUTCDate()).padStart(2, "0");
  const mm = String(l.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(l.getUTCHours()).padStart(2, "0");
  const mi = String(l.getUTCMinutes()).padStart(2, "0");
  return `${DIAS[l.getUTCDay()]} ${dd}/${mm} às ${hh}:${mi}`;
}

export function somarDias(data: string, n: number): string {
  const [a, m, d] = partes(data);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

export function diaDaSemana(data: string): string {
  const [a, m, d] = partes(data);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** [00:00 do dia, 00:00 do dia seguinte) em instantes reais. */
export function limitesDoDia(data: string): { inicio: Date; fim: Date } {
  return {
    inicio: paraInstante(data, "00:00") as Date,
    fim: paraInstante(somarDias(data, 1), "00:00") as Date,
  };
}

/** Segunda a domingo da semana que contem a data. */
export function limitesDaSemana(data: string): { inicio: Date; fim: Date } {
  const [a, m, d] = partes(data);
  const diasDesdeSegunda = (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
  const segunda = somarDias(data, -diasDesdeSegunda);
  return { inicio: limitesDoDia(segunda).inicio, fim: limitesDoDia(somarDias(segunda, 6)).fim };
}

/** Lista de dias a partir de hoje, com o dia da semana - ajuda a IA a resolver "quinta" sem fazer conta de calendario. */
export function proximosDias(hoje: string, quantos: number): { data: string; diaSemana: string }[] {
  return Array.from({ length: quantos }, (_, i) => {
    const data = somarDias(hoje, i);
    return { data, diaSemana: diaDaSemana(data) };
  });
}
