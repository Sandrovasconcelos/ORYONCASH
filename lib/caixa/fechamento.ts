import { ehClassificacao, type ClassificacaoCaixa } from "./tipos";

export type TransacaoDoFechamento = {
  tipo: "credito" | "debito";
  valor: number;
  classificacao: string | null;
  /** Debito ligado a uma despesa de obra. */
  despesaId: string | null;
  /** Obra da despesa (ou null = administrativo / sem obra). */
  obraNome: string | null;
};

export type Fechamento = {
  saldoInicial: number | null;
  entradas: {
    venda: number;
    aporte: number;
    rendimento: number;
    outraEntrada: number;
    naoClassificadas: number;
    total: number;
  };
  saidas: {
    porObra: { nome: string; total: number }[];
    outraSaida: number;
    naoClassificadas: number;
    total: number;
  };
  transferencias: { resgates: number; aplicacoes: number };
  /** Saldo inicial + tudo que entrou - tudo que saiu (inclui transferencias). Null sem saldo inicial. */
  saldoFinalCalculado: number | null;
  saldoFinalInformado: number | null;
  /** Informado - calculado. Null quando falta um dos dois. 0 = confere. */
  diferenca: number | null;
  /** Transacoes que ainda precisam de classificacao. */
  naoClassificadas: number;
};

const arredondar = (n: number) => Math.round(n * 100) / 100;

export const SEM_OBRA = "Administrativo / sem obra";

export function calcularFechamento(input: {
  saldoInicial: number | null;
  saldoFinalInformado: number | null;
  transacoes: TransacaoDoFechamento[];
}): Fechamento {
  const porObra = new Map<string, number>();
  const e = { venda: 0, aporte: 0, rendimento: 0, outraEntrada: 0, naoClassificadas: 0 };
  let outraSaida = 0;
  let saidasNaoClassificadas = 0;
  let resgates = 0;
  let aplicacoes = 0;
  let creditos = 0;
  let debitos = 0;
  let naoClassificadas = 0;

  for (const t of input.transacoes) {
    const classe: ClassificacaoCaixa | null = ehClassificacao(t.classificacao) ? t.classificacao : null;
    if (t.tipo === "credito") {
      creditos += t.valor;
      if (classe === "venda") e.venda += t.valor;
      else if (classe === "aporte") e.aporte += t.valor;
      else if (classe === "rendimento") e.rendimento += t.valor;
      else if (classe === "outra_entrada") e.outraEntrada += t.valor;
      else if (classe === "resgate") resgates += t.valor;
      else {
        e.naoClassificadas += t.valor;
        naoClassificadas += 1;
      }
    } else {
      debitos += t.valor;
      if (t.despesaId) {
        const nome = t.obraNome ?? SEM_OBRA;
        porObra.set(nome, (porObra.get(nome) ?? 0) + t.valor);
      } else if (classe === "aplicacao") aplicacoes += t.valor;
      else if (classe === "outra_saida") outraSaida += t.valor;
      else {
        saidasNaoClassificadas += t.valor;
        naoClassificadas += 1;
      }
    }
  }

  const totalSaidasObra = [...porObra.values()].reduce((s, v) => s + v, 0);
  const entradasTotal = e.venda + e.aporte + e.rendimento + e.outraEntrada + e.naoClassificadas;
  const saidasTotal = totalSaidasObra + outraSaida + saidasNaoClassificadas;

  const saldoFinalCalculado = input.saldoInicial === null ? null : arredondar(input.saldoInicial + creditos - debitos);
  const diferenca =
    saldoFinalCalculado === null || input.saldoFinalInformado === null ? null : arredondar(input.saldoFinalInformado - saldoFinalCalculado);

  return {
    saldoInicial: input.saldoInicial,
    entradas: {
      venda: arredondar(e.venda),
      aporte: arredondar(e.aporte),
      rendimento: arredondar(e.rendimento),
      outraEntrada: arredondar(e.outraEntrada),
      naoClassificadas: arredondar(e.naoClassificadas),
      total: arredondar(entradasTotal),
    },
    saidas: {
      porObra: [...porObra.entries()].map(([nome, total]) => ({ nome, total: arredondar(total) })).sort((a, b) => b.total - a.total),
      outraSaida: arredondar(outraSaida),
      naoClassificadas: arredondar(saidasNaoClassificadas),
      total: arredondar(saidasTotal),
    },
    transferencias: { resgates: arredondar(resgates), aplicacoes: arredondar(aplicacoes) },
    saldoFinalCalculado,
    saldoFinalInformado: input.saldoFinalInformado,
    diferenca,
    naoClassificadas,
  };
}

/** Primeiro e ultimo dia (AAAA-MM-DD) de um mes "AAAA-MM". Null se o formato for invalido. */
export function limitesDoMes(mes: string): { inicio: string; fim: string; anterior: string; proximo: string } | null {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const ano = Number(m[1]);
  const numero = Number(m[2]);
  if (numero < 1 || numero > 12) return null;
  const ultimo = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ant = new Date(Date.UTC(ano, numero - 2, 1));
  const prox = new Date(Date.UTC(ano, numero, 1));
  return {
    inicio: `${ano}-${pad(numero)}-01`,
    fim: `${ano}-${pad(numero)}-${pad(ultimo)}`,
    anterior: `${ant.getUTCFullYear()}-${pad(ant.getUTCMonth() + 1)}`,
    proximo: `${prox.getUTCFullYear()}-${pad(prox.getUTCMonth() + 1)}`,
  };
}

const NOMES_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function nomeDoMes(mes: string): string {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return mes;
  return `${NOMES_MESES[Number(m[2]) - 1] ?? m[2]} de ${m[1]}`;
}

export type SaldoBase = { data: string; valor: number; origem: "informado" | "conta" };

/**
 * Saldo de abertura de um mes: o ultimo saldo conhecido ate o fim do mes
 * anterior (informado do extrato, ou o saldo inicial da conta) mais o que
 * entrou e saiu depois dele. Sem nenhum saldo conhecido, nao da pra abrir.
 */
export function calcularAbertura(
  base: SaldoBase | null,
  movimentosDepoisDaBase: { tipo: "credito" | "debito"; valor: number }[]
): { valor: number; base: SaldoBase; ajustadoPor: number } | null {
  if (!base) return null;
  const liquido = movimentosDepoisDaBase.reduce((s, m) => s + (m.tipo === "credito" ? m.valor : -m.valor), 0);
  return { valor: arredondar(base.valor + liquido), base, ajustadoPor: movimentosDepoisDaBase.length };
}

/** O mais recente entre varios saldos conhecidos que nao passam do limite (AAAA-MM-DD). */
export function escolherSaldoBase(candidatos: SaldoBase[], ate: string): SaldoBase | null {
  const validos = candidatos.filter((c) => c.data <= ate).sort((a, b) => b.data.localeCompare(a.data));
  // Em empate de data, o informado do extrato vale mais que o saldo inicial cadastrado.
  return validos.find((c) => c.data === validos[0]?.data && c.origem === "informado") ?? validos[0] ?? null;
}

/** Dia anterior (AAAA-MM-DD). */
export function diaAnterior(dataISO: string): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Rendimento do investimento no periodo, sem precisar de extrato dele:
 * posicao final - posicao inicial - aplicacoes + resgates.
 */
export function rendimentoImplicito(input: {
  posicaoInicial: number | null;
  posicaoFinal: number | null;
  aplicacoes: number;
  resgates: number;
}): number | null {
  if (input.posicaoInicial === null || input.posicaoFinal === null) return null;
  return arredondar(input.posicaoFinal - input.posicaoInicial - input.aplicacoes + input.resgates);
}
