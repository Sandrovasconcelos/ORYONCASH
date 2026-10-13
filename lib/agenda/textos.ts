import { dataLocalDe, diaDaSemana, formatarInstante } from "./datas";

export type CompromissoResumo = {
  titulo: string;
  local: string | null;
  inicio: Date;
};

export function textoConfirmacao(c: CompromissoResumo, lembrarMin: number): string {
  return (
    `✅ *Agendado!*\n📌 ${c.titulo}\n🗓️ ${formatarInstante(c.inicio)}` +
    (c.local ? `\n📍 ${c.local}` : "") +
    (lembrarMin > 0 ? `\n⏰ Aviso ${rotuloAntecedencia(lembrarMin)} antes` : "\n⏰ Sem aviso antecipado")
  );
}

export function rotuloAntecedencia(min: number): string {
  if (min >= 60 && min % 60 === 0) return `${min / 60} h`;
  return `${min} min`;
}

function linha(c: CompromissoResumo, comData: boolean): string {
  const hora = formatarInstante(c.inicio).split(" às ")[1];
  const quando = comData ? formatarInstante(c.inicio) : hora;
  return `• ${quando} — ${c.titulo}${c.local ? ` (${c.local})` : ""}`;
}

/** Lista compromissos; quando passam de um dia, agrupa por dia (seg 12/10). */
export function textoAgenda(titulo: string, itens: CompromissoResumo[]): string {
  if (itens.length === 0) return `📭 ${titulo}: nenhum compromisso.`;
  const dias = new Set(itens.map((c) => dataLocalDe(c.inicio)));
  if (dias.size === 1) return `🗓️ *${titulo}*\n${itens.map((c) => linha(c, false)).join("\n")}`;

  const blocos: string[] = [];
  for (const dia of dias) {
    const [, m, d] = dia.split("-");
    blocos.push(`*${diaDaSemana(dia)} ${d}/${m}*\n${itens.filter((c) => dataLocalDe(c.inicio) === dia).map((c) => linha(c, false)).join("\n")}`);
  }
  return `🗓️ *${titulo}*\n\n${blocos.join("\n\n")}`;
}

export function textoLembrete(c: CompromissoResumo, minutosRestantes: number): string {
  const quando =
    minutosRestantes > 1 ? `em ${rotuloAntecedencia(minutosRestantes)}` : minutosRestantes >= 0 ? "agora" : "já começou";
  return `⏰ *Lembrete* — ${quando}\n📌 ${c.titulo}\n🗓️ ${formatarInstante(c.inicio)}${c.local ? `\n📍 ${c.local}` : ""}`;
}
