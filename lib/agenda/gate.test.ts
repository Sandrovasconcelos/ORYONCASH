import { describe, expect, it } from "vitest";
import { pareceAgenda } from "./gate";

describe("pareceAgenda", () => {
  it.each([
    "marca reunião com o Marsol quinta às 15h",
    "Agenda uma visita na obra amanhã 9h",
    "me lembra de ligar pro Alex hoje às 17:30",
    "me lembre de pagar o condomínio dia 10",
    "minha agenda",
    "quais são meus compromissos?",
    "o que eu tenho amanhã?",
    "o que tenho na semana?",
    "cancela a reunião com o Marsol",
    "desmarca o compromisso de quinta",
  ])("passa: %s", (texto) => {
    expect(pareceAgenda(texto)).toBe(true);
  });

  it.each([
    "cimento 350 costa 02",
    "quanto gastei com cimento?",
    "menu",
    "oi, bom dia",
    "reunião com o fornecedor",
    "Pagamento de energia da casa 07",
    "agenda",
    "150,00",
  ])("não passa: %s", (texto) => {
    expect(pareceAgenda(texto)).toBe(false);
  });
});
