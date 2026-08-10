import type { Alerta } from "@/lib/alertas/queries";

const SECOES: { tipo: Alerta["tipo"]; titulo: string }[] = [
  { tipo: "etapa_atrasada", titulo: "⚠️ *Etapas atrasadas*" },
  { tipo: "orcamento_estourado", titulo: "💰 *Orçamento estourado*" },
  { tipo: "saldo_negativo", titulo: "🏦 *Saldo negativo*" },
];

/**
 * O WhatsApp nao deixa a API definir nome/foto por mensagem - quem aparece
 * pro usuario e o perfil ja configurado do numero do bot. A "marca OryonCash"
 * fica no conteudo (cabecalho fixo em negrito + emoji), nao no remetente.
 */
export function formatarMensagemAlertas(alertas: Alerta[]): string | null {
  if (alertas.length === 0) return null;

  const hoje = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  const blocos = [`🏗️ *OryonCash* — Alerta diário`, `_${hoje}_`];

  for (const secao of SECOES) {
    const itens = alertas.filter((a) => a.tipo === secao.tipo);
    if (itens.length === 0) continue;
    blocos.push("", secao.titulo, ...itens.map((a) => `• ${a.mensagem}`));
  }

  return blocos.join("\n");
}
