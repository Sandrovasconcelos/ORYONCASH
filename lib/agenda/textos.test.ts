import { describe, expect, it } from "vitest";
import { paraInstante } from "./datas";
import { rotuloAntecedencia, textoAgenda, textoConfirmacao, textoLembrete } from "./textos";

const c = (data: string, hora: string, titulo: string, local: string | null = null) => ({
  titulo,
  local,
  inicio: paraInstante(data, hora)!,
});

describe("textos da agenda", () => {
  it("confirmação mostra título, dia, hora, local e aviso", () => {
    const t = textoConfirmacao(c("2026-10-15", "15:00", "Reunião com o Marsol", "Escritório"), 30);
    expect(t).toContain("Reunião com o Marsol");
    expect(t).toContain("qui 15/10 às 15:00");
    expect(t).toContain("Escritório");
    expect(t).toContain("30 min");
  });

  it("antecedência em horas quando for múltiplo de 60", () => {
    expect(rotuloAntecedencia(60)).toBe("1 h");
    expect(rotuloAntecedencia(120)).toBe("2 h");
    expect(rotuloAntecedencia(90)).toBe("90 min");
  });

  it("lista de um dia só mostra as horas; de vários agrupa por dia", () => {
    const um = textoAgenda("Hoje", [c("2026-10-15", "09:00", "Visita"), c("2026-10-15", "15:00", "Reunião")]);
    expect(um).toContain("• 09:00 — Visita");
    expect(um).not.toContain("qui 15/10");

    const varios = textoAgenda("Semana", [c("2026-10-15", "09:00", "Visita"), c("2026-10-16", "10:00", "Banco")]);
    expect(varios).toContain("*qui 15/10*");
    expect(varios).toContain("*sex 16/10*");
  });

  it("lista vazia", () => {
    expect(textoAgenda("Hoje", [])).toContain("nenhum compromisso");
  });

  it("lembrete diz em quanto tempo", () => {
    expect(textoLembrete(c("2026-10-15", "15:00", "Reunião"), 30)).toContain("em 30 min");
    expect(textoLembrete(c("2026-10-15", "15:00", "Reunião"), 0)).toContain("agora");
  });
});
