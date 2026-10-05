/**
 * Avisos que a Meta manda no mesmo webhook das mensagens: mudanca/ban da
 * conta, revisao, alertas, nome de exibicao, qualidade, modelos e falhas de
 * entrega. E ali que costuma vir o MOTIVO de um banimento - por isso nada
 * disso pode ser descartado em silencio.
 */

export type EventoMeta = {
  campo: string;
  evento: string;
  resumo: string;
  /** Vale avisar o dono na hora (conta, revisao, alertas, falhas graves de envio). */
  importante: boolean;
  payload: unknown;
};

type Json = Record<string, unknown>;

// Codigos de erro de envio que indicam risco pra conta (spam, limite, bloqueio...).
const CODIGOS_GRAVES = new Set([130429, 130497, 131031, 131045, 131048, 131049, 131056, 368]);

const CAMPOS_QUE_AVISAM = new Set([
  "account_update",
  "account_alerts",
  "account_review_update",
  "phone_number_name_update",
  "phone_number_quality_update",
  "security",
]);

const CHAVES_DE_DETALHE = [
  "event",
  "decision",
  "alert_type",
  "alert_severity",
  "alert_status",
  "alert_description",
  "rejection_reason",
  "requested_verified_name",
  "display_phone_number",
  "phone_number",
  "current_limit",
  "reason",
  "message_template_name",
  "ban_info",
  "violation_info",
  "restriction_info",
  "disable_info",
  "waba_info",
  "entity_type",
  "entity_id",
];

function texto(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "string") return valor;
  return JSON.stringify(valor);
}

function resumirValor(value: Json): string {
  const partes: string[] = [];
  for (const chave of CHAVES_DE_DETALHE) {
    if (value[chave] != null && value[chave] !== "") partes.push(`${chave}: ${texto(value[chave])}`);
  }
  const resumo = partes.length > 0 ? partes.join(" | ") : texto(value);
  return resumo.length > 900 ? `${resumo.slice(0, 900)}…` : resumo;
}

export function extrairEventosMeta(payload: unknown): EventoMeta[] {
  const eventos: EventoMeta[] = [];
  const entradas = ((payload as { entry?: unknown })?.entry ?? []) as Json[];
  if (!Array.isArray(entradas)) return eventos;

  for (const entrada of entradas) {
    const mudancas = (entrada?.changes ?? []) as Json[];
    if (!Array.isArray(mudancas)) continue;
    for (const mudanca of mudancas) {
      const campo = String(mudanca?.field ?? "");
      const value = (mudanca?.value ?? {}) as Json;

      if (campo === "messages") {
        // So interessam as falhas de entrega (statuses com erro); mensagens e
        // status normais seguem o fluxo de sempre.
        const statuses = (value.statuses ?? []) as Json[];
        for (const st of Array.isArray(statuses) ? statuses : []) {
          const erros = (st?.errors ?? []) as Json[];
          if (!Array.isArray(erros) || erros.length === 0) continue;
          for (const erro of erros) {
            const codigo = Number(erro?.code);
            const detalhe = texto((erro?.error_data as Json | undefined)?.details);
            eventos.push({
              campo: "messages/status",
              evento: `falha_envio_${Number.isFinite(codigo) ? codigo : "?"}`,
              resumo: `Falha ao enviar (erro ${erro?.code ?? "?"}): ${texto(erro?.title)} ${texto(erro?.message)} ${detalhe}`.trim(),
              importante: CODIGOS_GRAVES.has(codigo),
              payload: { status: st, erro },
            });
          }
        }
        continue;
      }

      eventos.push({
        campo,
        evento: texto(value.event ?? value.decision ?? value.alert_type ?? "") || campo,
        resumo: resumirValor(value),
        importante: CAMPOS_QUE_AVISAM.has(campo),
        payload: mudanca,
      });
    }
  }
  return eventos;
}

export function mensagemDeAviso(eventos: EventoMeta[]): string {
  const linhas = eventos.map((e) => `• *${e.campo}* — ${e.evento}\n  ${e.resumo}`);
  return `📨 *Aviso da Meta (WhatsApp)*\n\n${linhas.join("\n\n")}`;
}
