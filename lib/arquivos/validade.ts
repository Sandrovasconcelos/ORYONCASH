const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

export type ValidadeLida = { ok: true; data: string | null } | { ok: false };

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const pad = (n: number) => String(n).padStart(2, "0");

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function dataValida(ano: number, mes: number, dia: number): string | null {
  if (ano < 2000 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDoMes(ano, mes)) return null;
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

const anoCompleto = (a: number) => (a < 100 ? 2000 + a : a);

/**
 * Le uma validade escrita pela pessoa: "14/03/2027", "14/03/27", "03/2027"
 * (vale ate o fim do mes), "14 de março de 2027", "2027-03-14", ou "sem
 * validade" (data = null).
 */
export function lerValidade(texto: string): ValidadeLida {
  const t = semAcento(texto).replace(/[.,;]+$/, "");
  if (!t) return { ok: false };
  if (/^(sem|nao tem|nenhuma|nao vence|sem prazo|indeterminad[ao]|permanente)/.test(t)) return { ok: true, data: null };

  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = dataValida(+m[1], +m[2], +m[3]);
    return d ? { ok: true, data: d } : { ok: false };
  }

  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const d = dataValida(anoCompleto(+m[3]), +m[2], +m[1]);
    return d ? { ok: true, data: d } : { ok: false };
  }

  m = t.match(/^(\d{1,2})[/.-](\d{4}|\d{2})$/);
  if (m) {
    const ano = anoCompleto(+m[2]);
    const mes = +m[1];
    const d = dataValida(ano, mes, ultimoDiaDoMes(ano, mes) || 1);
    return d ? { ok: true, data: d } : { ok: false };
  }

  m = t.match(/^(\d{1,2}) de ([a-z]+)(?: de (\d{2}|\d{4}))?$/);
  if (m && MESES[m[2]]) {
    const ano = m[3] ? anoCompleto(+m[3]) : new Date().getUTCFullYear();
    const d = dataValida(ano, MESES[m[2]], +m[1]);
    return d ? { ok: true, data: d } : { ok: false };
  }

  m = t.match(/^([a-z]+)(?: de)? (\d{2}|\d{4})$/);
  if (m && MESES[m[1]]) {
    const ano = anoCompleto(+m[2]);
    const mes = MESES[m[1]];
    const d = dataValida(ano, mes, ultimoDiaDoMes(ano, mes));
    return d ? { ok: true, data: d } : { ok: false };
  }

  return { ok: false };
}

function numeroDoDia(data: string): number {
  const [a, m, d] = data.split("-").map(Number);
  return Math.floor(Date.UTC(a, m - 1, d) / 86_400_000);
}

/** Dias ate a validade (negativo = ja venceu). */
export function diasParaVencer(validade: string, hoje: string): number {
  return numeroDoDia(validade) - numeroDoDia(hoje);
}

export type SituacaoValidade = "sem_validade" | "ok" | "vencendo" | "vencido";

export function situacaoDaValidade(validade: string | null, hoje: string, avisarDiasAntes = 30): SituacaoValidade {
  if (!validade) return "sem_validade";
  const dias = diasParaVencer(validade, hoje);
  if (dias < 0) return "vencido";
  if (dias <= avisarDiasAntes) return "vencendo";
  return "ok";
}

export function formatarDataBR(data: string): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

/** "vence em 12 dias", "vence hoje", "venceu há 3 dias". */
export function textoDaValidade(validade: string, hoje: string): string {
  const dias = diasParaVencer(validade, hoje);
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return "venceu ontem";
  return `venceu há ${Math.abs(dias)} dias`;
}
