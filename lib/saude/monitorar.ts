import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacao, numeroNotificacao } from "@/lib/alertas/notificar";
import { botaoDashboard } from "@/lib/telegram/interativo";
import { decidirAviso, type Aviso } from "./decisao";
import { verificarTudo, type ResultadoCanal } from "./verificar";

export function montarMensagem(itens: { r: ResultadoCanal; aviso: Aviso }[]): string {
  const problemas = itens.filter((i) => i.aviso === "problema");
  const lembretes = itens.filter((i) => i.aviso === "lembrete");
  const recuperados = itens.filter((i) => i.aviso === "recuperado");

  const linha = (i: { r: ResultadoCanal }) => `• *${i.r.canal}*: ${i.r.detalhe}`;
  const blocos: string[] = ["🚨 *OryonCash — Alerta de sistema*"];
  if (problemas.length) blocos.push("", "❌ *Com problema*", ...problemas.map(linha));
  if (lembretes.length) blocos.push("", "⏰ *Continua com problema*", ...lembretes.map(linha));
  if (recuperados.length) blocos.push("", "✅ *Voltou ao normal*", ...recuperados.map((i) => `• *${i.r.canal}*`));
  return blocos.join("\n");
}

/**
 * Roda todas as checagens, avisa so o que mudou (ou lembra de vez em quando
 * o que segue quebrado) e grava o estado. Sem a tabela saude_canais criada,
 * avisa qualquer problema encontrado (sem memoria).
 */
export async function monitorarSaude(): Promise<{ resultados: ResultadoCanal[]; avisou: boolean }> {
  const resultados = await verificarTudo();
  const supabase = createAdminClient();
  const agora = Date.now();

  const { data: anteriores, error } = await supabase
    .from("saude_canais")
    .select("canal, ok, ultimo_aviso_em");
  const memoria = error ? null : new Map((anteriores ?? []).map((a) => [a.canal, a]));

  const itens: { r: ResultadoCanal; aviso: Aviso }[] = [];
  for (const r of resultados) {
    const aviso = decidirAviso(memoria?.get(r.canal) ?? null, r.ok, agora);
    if (aviso) itens.push({ r, aviso });
  }

  let avisou = false;
  if (itens.length > 0) {
    const numero = await numeroNotificacao();
    if (numero) {
      try {
        await enviarNotificacao(numero, montarMensagem(itens), { botoes: [[botaoDashboard()]] });
        avisou = true;
      } catch (e) {
        console.error("Falha ao enviar alerta de saude:", e);
      }
    }
  }

  if (!error) {
    const avisados = new Set(itens.map((i) => i.r.canal));
    await supabase.from("saude_canais").upsert(
      resultados.map((r) => {
        const antes = memoria?.get(r.canal);
        const mudou = !antes || antes.ok !== r.ok;
        return {
          canal: r.canal,
          ok: r.ok,
          detalhe: r.detalhe,
          ...(mudou ? { mudou_em: new Date(agora).toISOString() } : {}),
          ...(avisou && avisados.has(r.canal) ? { ultimo_aviso_em: new Date(agora).toISOString() } : {}),
        };
      })
    );
  }

  return { resultados, avisou };
}
