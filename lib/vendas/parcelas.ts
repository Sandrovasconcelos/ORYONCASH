export type TipoParcela = "entrada" | "parcela" | "intermediaria" | "chaves" | "outra";
export type StatusParcela = "a_receber" | "recebida" | "cancelada";

export type ParcelaGerada = { numero: number; tipo: TipoParcela; vencimento: string; valor: number };

const centavos = (n: number) => Math.round(n * 100);
const reais = (c: number) => c / 100;

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Soma meses mantendo o "dia de vencimento" (31 vira 28/29/30 nos meses curtos). */
export function somarMeses(dataISO: string, meses: number, diaFixo?: number): string {
  const [a, m, d] = dataISO.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const dia = Math.min(diaFixo ?? d, ultimoDiaDoMes(ano, mes));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Gera as parcelas de uma venda: entrada opcional + N parcelas mensais iguais.
 * A diferenca de centavos (divisao nao exata) vai pra ultima parcela, pra a
 * soma fechar exatamente no valor total.
 */
export function gerarParcelas(input: {
  valorTotal: number;
  entradaValor?: number | null;
  entradaData?: string | null;
  quantidade: number;
  primeiroVencimento: string;
  /** Valor de cada parcela; se vazio, divide o restante em partes iguais. */
  valorParcela?: number | null;
}): ParcelaGerada[] {
  const totalC = centavos(input.valorTotal);
  const entradaC = input.entradaValor && input.entradaValor > 0 ? centavos(input.entradaValor) : 0;
  const quantidade = Math.max(0, Math.floor(input.quantidade));
  const parcelas: ParcelaGerada[] = [];

  if (entradaC > 0) {
    parcelas.push({ numero: 0, tipo: "entrada", vencimento: input.entradaData || input.primeiroVencimento, valor: reais(entradaC) });
  }
  if (quantidade === 0) return parcelas;

  const restanteC = totalC - entradaC;
  if (restanteC <= 0) return parcelas;

  const baseC = input.valorParcela && input.valorParcela > 0 ? centavos(input.valorParcela) : Math.floor(restanteC / quantidade);
  const diaFixo = Number(input.primeiroVencimento.split("-")[2]);
  let acumulado = 0;
  for (let i = 0; i < quantidade; i++) {
    const ultima = i === quantidade - 1;
    const valorC = ultima && !(input.valorParcela && input.valorParcela > 0) ? restanteC - acumulado : baseC;
    acumulado += valorC;
    if (valorC <= 0) break;
    parcelas.push({
      numero: i + 1,
      tipo: "parcela",
      vencimento: somarMeses(input.primeiroVencimento, i, diaFixo),
      valor: reais(valorC),
    });
  }
  return parcelas;
}

export type SituacaoParcela = "recebida" | "cancelada" | "atrasada" | "vence_hoje" | "a_vencer";

export function situacaoDaParcela(p: { status: StatusParcela; vencimento: string }, hoje: string): SituacaoParcela {
  if (p.status === "recebida") return "recebida";
  if (p.status === "cancelada") return "cancelada";
  if (p.vencimento < hoje) return "atrasada";
  if (p.vencimento === hoje) return "vence_hoje";
  return "a_vencer";
}

export type ResumoDaVenda = {
  total: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  percentualPago: number;
  proxima: { vencimento: string; valor: number } | null;
  atrasadas: number;
};

export function resumirVenda(
  parcelas: { status: StatusParcela; vencimento: string; valor: number; valor_recebido: number | null }[],
  hoje: string
): ResumoDaVenda {
  let total = 0;
  let recebido = 0;
  let atrasado = 0;
  let atrasadas = 0;
  let proxima: { vencimento: string; valor: number } | null = null;
  for (const p of parcelas) {
    if (p.status === "cancelada") continue;
    total += p.valor;
    if (p.status === "recebida") {
      recebido += p.valor_recebido ?? p.valor;
      continue;
    }
    if (p.vencimento < hoje) {
      atrasado += p.valor;
      atrasadas += 1;
    }
    if (!proxima || p.vencimento < proxima.vencimento) proxima = { vencimento: p.vencimento, valor: p.valor };
  }
  const arred = (n: number) => Math.round(n * 100) / 100;
  return {
    total: arred(total),
    recebido: arred(recebido),
    aReceber: arred(Math.max(total - recebido, 0)),
    atrasado: arred(atrasado),
    percentualPago: total > 0 ? Math.min(100, Math.round((recebido / total) * 100)) : 0,
    proxima,
    atrasadas,
  };
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function diasEntre(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000));
}

export type ParcelaCandidata = { id: string; vendaId: string; clienteNome: string; numero: number; vencimento: string; valor: number };

/**
 * Qual(is) parcela(s) em aberto um credito do extrato pode ter quitado: mesmo
 * valor (centavo), vencimento perto da data do credito, e de preferencia o
 * nome do cliente no texto do extrato. Melhores primeiro.
 */
export function sugerirParcelas(
  credito: { valor: number; data: string; descricao: string | null },
  parcelas: ParcelaCandidata[],
  janelaDias = 45
): ParcelaCandidata[] {
  const texto = normalizar(credito.descricao ?? "");
  const pontuadas = parcelas
    .filter((p) => centavos(p.valor) === centavos(credito.valor) && diasEntre(p.vencimento, credito.data) <= janelaDias)
    .map((p) => {
      const palavras = normalizar(p.clienteNome)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3);
      const casouNome = palavras.length > 0 && palavras.some((w) => texto.includes(w));
      return { p, nome: casouNome ? 1 : 0, dist: diasEntre(p.vencimento, credito.data) };
    })
    .sort((x, y) => y.nome - x.nome || x.dist - y.dist || x.p.numero - y.p.numero);
  return pontuadas.map((x) => x.p);
}
