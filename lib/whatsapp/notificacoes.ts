import type { Alerta } from "@/lib/alertas/queries";
import type { ResumoPeriodo } from "@/lib/alertas/resumos";
import { formatBRL } from "@/lib/conversation/format";

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

function formatarBlocoPorObraEtapa(porObraEtapa: ResumoPeriodo["porObraEtapa"]): string[] {
  const porObra = new Map<string, { etapaNome: string | null; total: number }[]>();
  for (const item of porObraEtapa) {
    const lista = porObra.get(item.obraNome) ?? [];
    lista.push({ etapaNome: item.etapaNome, total: item.total });
    porObra.set(item.obraNome, lista);
  }

  const blocos: string[] = [];
  for (const [obraNome, itens] of porObra) {
    const totalObra = itens.reduce((soma, i) => soma + i.total, 0);
    blocos.push(`*${obraNome}* — ${formatBRL(totalObra)}`);
    for (const item of itens) {
      blocos.push(`   • ${item.etapaNome ?? "Sem etapa"}: ${formatBRL(item.total)}`);
    }
  }
  return blocos;
}

export function formatarResumoDiario(dataLabel: string, resumo: ResumoPeriodo): string {
  if (resumo.total === 0) {
    return [`🏗️ *OryonCash* — Resumo do dia`, `_${dataLabel}_`, "", "Nenhum lançamento hoje."].join("\n");
  }

  const blocos = [
    `🏗️ *OryonCash* — Resumo do dia`,
    `_${dataLabel}_`,
    "",
    `💰 Total: *${formatBRL(resumo.total)}*`,
  ];

  if (resumo.porConta.length > 0) {
    blocos.push("", "🏦 *Por conta*", ...resumo.porConta.map((c) => `• ${c.nome}: ${formatBRL(c.total)}`));
  }

  const blocoObraEtapa = formatarBlocoPorObraEtapa(resumo.porObraEtapa);
  if (blocoObraEtapa.length > 0) {
    blocos.push("", "🏗️ *Por obra/etapa*", ...blocoObraEtapa);
  }

  return blocos.join("\n");
}

export function formatarResumoSemanal(periodoLabel: string, resumo: ResumoPeriodo): string {
  if (resumo.total === 0) {
    return [`🏗️ *OryonCash* — Resumo da semana`, `_${periodoLabel}_`, "", "Nenhum lançamento na semana."].join(
      "\n"
    );
  }

  const blocos = [
    `🏗️ *OryonCash* — Resumo da semana`,
    `_${periodoLabel}_`,
    "",
    `💰 Total: *${formatBRL(resumo.total)}*`,
  ];

  if (resumo.porConta.length > 0) {
    blocos.push("", "🏦 *Por conta*", ...resumo.porConta.map((c) => `• ${c.nome}: ${formatBRL(c.total)}`));
  }

  const blocoObraEtapa = formatarBlocoPorObraEtapa(resumo.porObraEtapa);
  if (blocoObraEtapa.length > 0) {
    blocos.push("", "🏗️ *Por obra/etapa*", ...blocoObraEtapa);
  }

  return blocos.join("\n");
}

export function formatarNotificacaoLancamento(input: {
  valor: number;
  categoriaNome: string;
  obraNome: string | null;
  autorNome: string | null;
  documentoAnexado: "documento_cobranca" | "comprovante_pagamento" | null;
}): string {
  const partes = [`💸 Novo lançamento — ${formatBRL(input.valor)} em ${input.categoriaNome}`];
  if (input.obraNome) partes.push(`Obra: ${input.obraNome}`);
  if (input.autorNome) partes.push(`Por: ${input.autorNome}`);

  const notaAnexada = input.documentoAnexado === "documento_cobranca";
  const comprovanteAnexado = input.documentoAnexado === "comprovante_pagamento";
  partes.push(`📄 Nota/conta: ${notaAnexada ? "anexada" : "não anexada"}`);
  partes.push(`💳 Comprovante de pagamento: ${comprovanteAnexado ? "anexado" : "ainda não anexado"}`);

  return partes.join("\n");
}

export function formatarNotificacaoComprovantePagamento(input: {
  valor: number;
  obraNome: string | null;
  autorNome: string | null;
}): string {
  const partes = [`💳 Comprovante de pagamento anexado — ${formatBRL(input.valor)}`];
  if (input.obraNome) partes.push(`Obra: ${input.obraNome}`);
  if (input.autorNome) partes.push(`Por: ${input.autorNome}`);
  return partes.join("\n");
}
