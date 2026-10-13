import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacao } from "@/lib/alertas/notificar";
import { ehDono } from "@/lib/acesso/dono";
import { sendText } from "@/lib/whatsapp/messages";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { limitesDoDia } from "./datas";
import { textoAgenda, textoLembrete } from "./textos";

/**
 * Manda o aviso. Pro dono (numero de notificacoes) usa o caminho com desvio
 * pro Telegram; pros demais, so o proprio canal - a agenda de cada pessoa nao
 * vai pra outra pessoa. No WhatsApp, fora da janela de 24h desde a ultima
 * mensagem da pessoa, a Meta recusa texto livre (so modelo aprovado passa).
 */
async function entregar(telefone: string, mensagem: string): Promise<boolean> {
  try {
    // Pro dono, se o WhatsApp falhar (ex: fora da janela de 24h) o aviso segue pro Telegram.
    if (await ehDono(telefone)) await enviarNotificacao(telefone, mensagem);
    else await sendText(telefone, mensagem);
    return true;
  } catch (error) {
    console.error(`Falha ao entregar aviso de agenda pra ${telefone}:`, error);
    return false;
  }
}

/** Chamado a cada ~5 min (GitHub Actions): avisa os compromissos cujo horario de lembrete chegou. */
export async function enviarLembretesVencidos(agora = new Date()): Promise<{ enviados: number; falhas: number }> {
  const supabase = createAdminClient();
  const limiteInferior = new Date(agora.getTime() - 30 * 60_000); // nao avisa de coisa que ja passou ha tempos
  const limiteSuperior = new Date(agora.getTime() + 24 * 3_600_000);

  const { data } = await supabase
    .from("compromissos")
    .select("id, telefone, titulo, local, inicio, lembrar_min_antes")
    .eq("status", "agendado")
    .is("lembrete_enviado_em", null)
    .gt("inicio", limiteInferior.toISOString())
    .lte("inicio", limiteSuperior.toISOString())
    .order("inicio")
    .limit(200);

  let enviados = 0;
  let falhas = 0;
  for (const c of data ?? []) {
    const inicio = new Date(c.inicio);
    if (inicio.getTime() - c.lembrar_min_antes * 60_000 > agora.getTime()) continue; // ainda nao e a hora

    // Reserva o envio (evita aviso duplicado se duas chamadas se cruzarem).
    const { data: reservado } = await supabase
      .from("compromissos")
      .update({ lembrete_enviado_em: agora.toISOString() })
      .eq("id", c.id)
      .is("lembrete_enviado_em", null)
      .select("id");
    if (!reservado || reservado.length === 0) continue;

    const minutos = Math.round((inicio.getTime() - agora.getTime()) / 60_000);
    const ok = await entregar(c.telefone, textoLembrete({ titulo: c.titulo, local: c.local, inicio }, minutos));
    if (ok) enviados += 1;
    else {
      falhas += 1;
      // libera pra tentar de novo na proxima rodada (ate o horario passar)
      await supabase.from("compromissos").update({ lembrete_enviado_em: null }).eq("id", c.id);
    }
  }
  return { enviados, falhas };
}

/** Chamado de manha junto do aviso diario: cada pessoa recebe a agenda do proprio dia. */
export async function enviarAgendaDoDia(): Promise<{ pessoas: number }> {
  const supabase = createAdminClient();
  const { inicio, fim } = limitesDoDia(hojeNoBrasil());
  const { data } = await supabase
    .from("compromissos")
    .select("telefone, titulo, local, inicio")
    .eq("status", "agendado")
    .gte("inicio", inicio.toISOString())
    .lt("inicio", fim.toISOString())
    .order("inicio")
    .limit(500);

  const porPessoa = new Map<string, { titulo: string; local: string | null; inicio: Date }[]>();
  for (const c of data ?? []) {
    const lista = porPessoa.get(c.telefone) ?? [];
    lista.push({ titulo: c.titulo, local: c.local, inicio: new Date(c.inicio) });
    porPessoa.set(c.telefone, lista);
  }

  let pessoas = 0;
  for (const [telefone, itens] of porPessoa) {
    if (await entregar(telefone, textoAgenda("Bom dia! Sua agenda de hoje", itens))) pessoas += 1;
  }
  return { pessoas };
}
