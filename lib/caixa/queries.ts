import { createAdminClient } from "@/lib/supabase/admin";
import {
  calcularAbertura,
  calcularFechamento,
  diaAnterior,
  escolherSaldoBase,
  limitesDoMes,
  rendimentoImplicito,
  type Fechamento,
  type SaldoBase,
  type TransacaoDoFechamento,
} from "./fechamento";

export type ContaDoFechamento = { id: string; nome: string; tipo: "corrente" | "investimento"; saldo_inicial: number; data_saldo_inicial: string | null };

export type DadosDoFechamento = {
  conta: ContaDoFechamento;
  mes: string;
  limites: { inicio: string; fim: string; anterior: string; proximo: string };
  fechamento: Fechamento;
  /** De onde veio o saldo inicial (texto pra tela), ou null se nao da pra abrir o mes. */
  origemDaAbertura: string | null;
  /** Sem extrato nenhum no mes: o fechamento ainda nao tem como bater. */
  semExtrato: boolean;
  investimento: {
    conta: ContaDoFechamento;
    posicaoInicial: number | null;
    posicaoFinal: number | null;
    rendimento: number | null;
  } | null;
};

type Linha = {
  data: string;
  valor: number;
  tipo: "credito" | "debito";
  classificacao: string | null;
  despesa_id: string | null;
  despesas?: { obras?: { nome: string } | null } | null;
};

async function transacoesDaConta(contaId: string, de: string, ate: string): Promise<Linha[]> {
  const { data } = await createAdminClient()
    .from("extrato_transacoes")
    .select("data, valor, tipo, classificacao, despesa_id, despesas(obras(nome)), extratos_bancarios!inner(conta_bancaria_id)")
    .eq("extratos_bancarios.conta_bancaria_id", contaId)
    .gte("data", de)
    .lte("data", ate)
    .limit(10000);
  return (data ?? []) as unknown as Linha[];
}

const formatarDia = (iso: string) => iso.split("-").reverse().join("/");

/** Contas disponiveis pro fechamento (correntes primeiro). Vazio enquanto as colunas novas nao existirem. */
export async function listarContasDoFechamento(): Promise<ContaDoFechamento[]> {
  const { data, error } = await createAdminClient()
    .from("contas_bancarias")
    .select("id, nome, tipo, saldo_inicial, data_saldo_inicial")
    .is("deleted_at", null)
    .order("nome");
  if (error || !data) return [];
  return (data as ContaDoFechamento[]).sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : a.tipo === "corrente" ? -1 : 1));
}

async function saldoBaseAte(conta: ContaDoFechamento, ate: string): Promise<SaldoBase | null> {
  const { data } = await createAdminClient()
    .from("saldos_conta")
    .select("data, valor")
    .eq("conta_bancaria_id", conta.id)
    .lte("data", ate)
    .order("data", { ascending: false })
    .limit(1);
  const candidatos: SaldoBase[] = (data ?? []).map((s) => ({ data: s.data, valor: s.valor, origem: "informado" as const }));
  if (conta.data_saldo_inicial) candidatos.push({ data: conta.data_saldo_inicial, valor: Number(conta.saldo_inicial), origem: "conta" });
  return escolherSaldoBase(candidatos, ate);
}

async function saldoNoFim(conta: ContaDoFechamento, fim: string): Promise<number | null> {
  const { data } = await createAdminClient().from("saldos_conta").select("valor").eq("conta_bancaria_id", conta.id).eq("data", fim).maybeSingle();
  return data ? data.valor : null;
}

export async function carregarFechamento(conta: ContaDoFechamento, mes: string, investimentos: ContaDoFechamento[]): Promise<DadosDoFechamento | null> {
  const limites = limitesDoMes(mes);
  if (!limites) return null;

  const fimAnterior = diaAnterior(limites.inicio);
  const [base, linhas, saldoFinalInformado] = await Promise.all([
    saldoBaseAte(conta, fimAnterior),
    transacoesDaConta(conta.id, limites.inicio, limites.fim),
    saldoNoFim(conta, limites.fim),
  ]);

  // Movimentos entre o ultimo saldo conhecido e a abertura do mes.
  const entreBaseEAbertura = base && base.data < fimAnterior ? await transacoesDaConta(conta.id, diaSeguinte(base.data), fimAnterior) : [];
  const abertura = calcularAbertura(base, entreBaseEAbertura);

  const transacoes: TransacaoDoFechamento[] = linhas.map((l) => ({
    tipo: l.tipo,
    valor: l.valor,
    classificacao: l.classificacao,
    despesaId: l.despesa_id,
    obraNome: l.despesas?.obras?.nome ?? null,
  }));
  const fechamento = calcularFechamento({ saldoInicial: abertura?.valor ?? null, saldoFinalInformado, transacoes });

  let origemDaAbertura: string | null = null;
  if (abertura) {
    origemDaAbertura =
      abertura.base.origem === "informado" ? `saldo informado em ${formatarDia(abertura.base.data)}` : `saldo inicial da conta (${formatarDia(abertura.base.data)})`;
    if (abertura.ajustadoPor > 0) origemDaAbertura += `, mais ${abertura.ajustadoPor} movimento(s) até ${formatarDia(fimAnterior)}`;
  }

  // Investimento (primeira conta de investimento): posicao e rendimento do mes.
  let investimento: DadosDoFechamento["investimento"] = null;
  const inv = investimentos[0];
  if (inv) {
    const [inicial, final] = await Promise.all([saldoBaseAte(inv, fimAnterior), saldoBaseAte(inv, limites.fim)]);
    const posicaoInicial = inicial?.valor ?? null;
    const posicaoFinal = final && final.data > fimAnterior ? final.valor : null;
    investimento = {
      conta: inv,
      posicaoInicial,
      posicaoFinal,
      rendimento: rendimentoImplicito({
        posicaoInicial,
        posicaoFinal,
        aplicacoes: fechamento.transferencias.aplicacoes,
        resgates: fechamento.transferencias.resgates,
      }),
    };
  }

  return { conta, mes, limites, fechamento, origemDaAbertura, semExtrato: linhas.length === 0, investimento };
}

function diaSeguinte(dataISO: string): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
