function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const REFERENCIA_DE_TEMPO =
  /\b(hoje|amanha|depois de amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|dia \d{1,2}|\d{1,2}\/\d{1,2}|as? \d{1,2}|\d{1,2} ?h(oras?)?|\d{1,2}:\d{2}|semana que vem|proxima semana)\b/;

/**
 * Filtro barato antes de chamar o Gemini: so passa o que tem cara de pedido
 * de agenda - marcar/lembrar com uma referencia de tempo, ver a agenda ou
 * cancelar um compromisso. O Gemini confirma de verdade depois.
 */
export function pareceAgenda(texto: string): boolean {
  const t = semAcento(texto.trim());
  if (t.length < 8) return false;

  // criar: "marca reuniao com o Marsol quinta as 15h", "me lembra de ligar amanha 9h"
  if (/\b(marca|marcar|marque|agenda|agendar|agende|me lembra|me lembre|lembrete|lembrar de)\b/.test(t) && REFERENCIA_DE_TEMPO.test(t)) {
    return true;
  }

  // listar: "minha agenda", "o que tenho amanha", "meus compromissos da semana"
  if (/\b(minha agenda|meus compromissos|meus lembretes|quais (sao )?(meus )?compromissos)\b/.test(t)) return true;
  if (/\bo que (eu )?(tenho|tem) (pra|para|na|no|hoje|amanha|esta|essa|nesta|nessa)\b/.test(t) && /(hoje|amanha|semana|agenda|compromisso|reuniao)/.test(t)) {
    return true;
  }

  // cancelar: "cancela a reuniao com o Marsol"
  if (/\b(cancela|cancelar|cancele|desmarca|desmarcar|desmarque)\b/.test(t) && /(reuniao|compromisso|consulta|evento|lembrete|visita)/.test(t)) {
    return true;
  }

  return false;
}
