import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/messages";
import { interpretarAgenda, type PedidoAgenda } from "@/lib/gemini/interpretarAgenda";
import { ehTelegram } from "@/lib/telegram/ids";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { candidatosPorPista } from "@/lib/conversation/agruparPorNome";
import { dataLocalDe, formatarInstante, limitesDaSemana, limitesDoDia, paraInstante, somarDias } from "./datas";
import { pareceAgenda } from "./gate";
import { textoAgenda, textoConfirmacao, type CompromissoResumo } from "./textos";

type Linha = { id: string; titulo: string; local: string | null; inicio: string };

const paraResumo = (l: Linha): CompromissoResumo => ({ titulo: l.titulo, local: l.local, inicio: new Date(l.inicio) });

async function buscar(telefone: string, de: Date, ate: Date): Promise<Linha[]> {
  const { data } = await createAdminClient()
    .from("compromissos")
    .select("id, titulo, local, inicio")
    .eq("telefone", telefone)
    .eq("status", "agendado")
    .gte("inicio", de.toISOString())
    .lt("inicio", ate.toISOString())
    .order("inicio")
    .limit(100);
  return data ?? [];
}

async function criar(from: string, bruto: PedidoAgenda): Promise<void> {
  // Defesa: titulo curto, mesmo se a IA exagerar.
  const p: PedidoAgenda = { ...bruto, titulo: bruto.titulo?.trim().slice(0, 80) || null };
  if (!p.titulo) {
    await sendText(from, '🤔 O que eu agendo? Ex: "marca reunião com o Marsol quinta às 15h".');
    return;
  }
  if (!p.data) {
    await sendText(from, `📅 Pra qual dia? Ex: "${p.titulo} amanhã às 15h".`);
    return;
  }
  if (!p.hora) {
    await sendText(from, `⏰ Que horas? Ex: "${p.titulo} ${formatarDiaSimples(p.data)} às 15h".`);
    return;
  }
  const inicio = paraInstante(p.data, p.hora);
  if (!inicio) {
    await sendText(from, "🤔 Não entendi a data/hora. Tenta de novo, ex: quinta às 15h.");
    return;
  }
  if (inicio.getTime() < Date.now() - 60_000) {
    await sendText(from, `⚠️ ${formatarInstante(inicio)} já passou. Confere o dia e manda de novo.`);
    return;
  }

  const lembrar = Math.min(Math.max(Math.round(p.lembrarMinAntes ?? 30), 0), 24 * 60);
  const { error } = await createAdminClient()
    .from("compromissos")
    .insert({
      telefone: from,
      titulo: p.titulo.trim(),
      local: p.local?.trim() || null,
      inicio: inicio.toISOString(),
      lembrar_min_antes: lembrar,
      origem: ehTelegram(from) ? "telegram" : "whatsapp",
    });
  if (error) {
    console.error("Erro ao agendar:", error.message);
    await sendText(from, "⚠️ Não consegui salvar o compromisso agora. Tenta de novo em instantes.");
    return;
  }
  await sendText(from, textoConfirmacao({ titulo: p.titulo.trim(), local: p.local?.trim() || null, inicio }, lembrar));
}

function formatarDiaSimples(data: string): string {
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

async function listar(from: string, p: PedidoAgenda): Promise<void> {
  const hoje = hojeNoBrasil();
  let titulo: string;
  let de: Date;
  let ate: Date;

  switch (p.periodo) {
    case "hoje":
      ({ inicio: de, fim: ate } = limitesDoDia(hoje));
      titulo = "Sua agenda de hoje";
      break;
    case "amanha":
      ({ inicio: de, fim: ate } = limitesDoDia(somarDias(hoje, 1)));
      titulo = "Sua agenda de amanhã";
      break;
    case "semana":
      ({ inicio: de, fim: ate } = limitesDaSemana(hoje));
      de = new Date(Math.max(de.getTime(), Date.now()));
      titulo = "Sua agenda da semana";
      break;
    case "data":
      if (p.data) {
        ({ inicio: de, fim: ate } = limitesDoDia(p.data));
        titulo = `Sua agenda de ${formatarDiaSimples(p.data)}`;
        break;
      }
    // sem data valida: cai nos proximos dias
    default:
      de = new Date();
      ate = limitesDoDia(somarDias(hoje, 8)).inicio;
      titulo = "Seus próximos compromissos";
  }
  const itens = await buscar(from, de, ate);
  await sendText(from, textoAgenda(titulo, itens.map(paraResumo)));
}

async function cancelar(from: string, p: PedidoAgenda): Promise<void> {
  const agora = new Date();
  const candidatosBrutos = await buscar(from, new Date(agora.getTime() - 12 * 3_600_000), limitesDoDia(somarDias(hojeNoBrasil(), 60)).inicio);

  let candidatos = candidatosBrutos;
  if (p.data) candidatos = candidatos.filter((c) => dataLocalDe(new Date(c.inicio)) === p.data);
  if (p.termoBusca) candidatos = candidatosPorPista(candidatos.map((c) => ({ ...c, nome: c.titulo })), p.termoBusca);
  if (!p.termoBusca && !p.data) {
    await sendText(from, '🤔 Qual compromisso cancelo? Ex: "cancela a reunião com o Marsol".');
    return;
  }

  if (candidatos.length === 0) {
    await sendText(from, "🤔 Não achei esse compromisso na sua agenda. Manda *minha agenda* pra ver os que estão marcados.");
    return;
  }
  if (candidatos.length > 1) {
    const lista = candidatos
      .slice(0, 6)
      .map((c) => `• ${formatarInstante(new Date(c.inicio))} — ${c.titulo}`)
      .join("\n");
    await sendText(from, `🤔 Achei mais de um:\n${lista}\n\nDiz qual, com mais detalhe (ex: "cancela a reunião de quinta").`);
    return;
  }
  const alvo = candidatos[0];
  await createAdminClient().from("compromissos").update({ status: "cancelado" }).eq("id", alvo.id);
  await sendText(from, `🗑️ Cancelado: *${alvo.titulo}* (${formatarInstante(new Date(alvo.inicio))}).`);
}

/**
 * Tenta tratar a mensagem como pedido de agenda (marcar, ver ou cancelar um
 * compromisso). True quando respondeu. So chamada com o usuario no menu.
 */
export async function tentarAgenda(from: string, texto: string | null): Promise<boolean> {
  const t = texto?.trim();
  if (!t || !pareceAgenda(t)) return false;
  try {
    const pedido = await interpretarAgenda(t, hojeNoBrasil());
    if (!pedido?.ehAgenda || !pedido.acao) return false;
    if (pedido.acao === "criar") await criar(from, pedido);
    else if (pedido.acao === "listar") await listar(from, pedido);
    else await cancelar(from, pedido);
    return true;
  } catch (error) {
    console.error("Erro na agenda:", error);
    return false;
  }
}
