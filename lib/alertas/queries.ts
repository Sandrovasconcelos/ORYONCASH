import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { hojeNoBrasil } from "@/lib/conversation/queries";

export type Alerta = {
  tipo: "etapa_atrasada" | "orcamento_estourado" | "saldo_negativo";
  obraNome: string | null;
  mensagem: string;
};

function parseISO(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * "Schedule variance": compara % do prazo ja decorrido com % realmente
 * executado. Fonte de progresso e prazo e a propria etapa
 * (percentual_executado + datas previstas) - o cronograma detalhado
 * (fases/atividades) saiu da interface e nao alimenta mais nada aqui.
 */
function etapaEstaAtrasada(percentualReal: number, inicio: Date, fim: Date, hoje: Date): boolean {
  if (percentualReal >= 100) return false;
  if (hoje < inicio) return false;
  if (hoje > fim) return true;

  const duracaoTotal = diasEntre(inicio, fim) || 1;
  const percentualEsperado = (diasEntre(inicio, hoje) / duracaoTotal) * 100;
  return percentualReal + 5 < percentualEsperado;
}

async function buscarEtapasAtrasadas(): Promise<Alerta[]> {
  const supabase = createAdminClient();
  const hoje = parseISO(hojeNoBrasil());

  const { data: obras } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("status", "ativa")
    .is("deleted_at", null);
  if (!obras || obras.length === 0) return [];
  const nomesObra = new Map(obras.map((o) => [o.id, o.nome]));

  const { data: etapas } = await supabase
    .from("etapas")
    .select("id, obra_id, nome, data_inicio_prevista, data_fim_prevista, percentual_executado")
    .in(
      "obra_id",
      obras.map((o) => o.id)
    )
    .is("deleted_at", null)
    .not("data_inicio_prevista", "is", null)
    .not("data_fim_prevista", "is", null);
  if (!etapas || etapas.length === 0) return [];

  const alertas: Alerta[] = [];
  for (const etapa of etapas) {
    if (!etapa.data_inicio_prevista || !etapa.data_fim_prevista || !etapa.obra_id) continue;
    if (
      etapaEstaAtrasada(
        Number(etapa.percentual_executado),
        parseISO(etapa.data_inicio_prevista),
        parseISO(etapa.data_fim_prevista),
        hoje
      )
    ) {
      const obraNome = nomesObra.get(etapa.obra_id) ?? "Obra";
      alertas.push({
        tipo: "etapa_atrasada",
        obraNome,
        mensagem: `${etapa.nome} (${obraNome})`,
      });
    }
  }
  return alertas;
}

async function buscarContratosEstourados(): Promise<Alerta[]> {
  const supabase = createAdminClient();

  const { data: obras } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("status", "ativa")
    .is("deleted_at", null);
  if (!obras || obras.length === 0) return [];
  const obraIds = obras.map((o) => o.id);
  const nomesObra = new Map(obras.map((o) => [o.id, o.nome]));

  const [{ data: contratos }, { data: despesas }, { data: fornecedores }] = await Promise.all([
    supabase
      .from("contratos_fornecedor")
      .select("id, obra_id, fornecedor_id, etapa_id, valor_contrato")
      .in("obra_id", obraIds)
      .is("deleted_at", null),
    supabase
      .from("despesas")
      .select("obra_id, etapa_id, fornecedor_id, valor")
      .in("obra_id", obraIds)
      .is("deleted_at", null),
    supabase.from("fornecedores").select("id, nome"),
  ]);
  if (!contratos || contratos.length === 0) return [];
  const nomesFornecedor = new Map((fornecedores ?? []).map((f) => [f.id, f.nome]));

  const despesasPorObra = new Map<
    string,
    { etapa_id: string | null; fornecedor_id: string | null; valor: number }[]
  >();
  for (const d of despesas ?? []) {
    if (!d.obra_id) continue;
    const lista = despesasPorObra.get(d.obra_id) ?? [];
    lista.push(d);
    despesasPorObra.set(d.obra_id, lista);
  }

  const contratosPorObra = new Map<string, typeof contratos>();
  for (const c of contratos) {
    const lista = contratosPorObra.get(c.obra_id) ?? [];
    lista.push(c);
    contratosPorObra.set(c.obra_id, lista);
  }

  const alertas: Alerta[] = [];
  for (const [obraId, contratosObra] of contratosPorObra) {
    const despesasObra = despesasPorObra.get(obraId) ?? [];

    const pagoPorFornecedor = new Map<string, number>();
    const pagoPorFornecedorEEtapa = new Map<string, number>();
    for (const d of despesasObra) {
      if (!d.fornecedor_id) continue;
      pagoPorFornecedor.set(d.fornecedor_id, (pagoPorFornecedor.get(d.fornecedor_id) ?? 0) + d.valor);
      if (d.etapa_id) {
        const chave = `${d.fornecedor_id}::${d.etapa_id}`;
        pagoPorFornecedorEEtapa.set(chave, (pagoPorFornecedorEEtapa.get(chave) ?? 0) + d.valor);
      }
    }

    const etapasEscopadasPorFornecedor = new Map<string, Set<string>>();
    for (const c of contratosObra) {
      if (!c.etapa_id) continue;
      const etapas = etapasEscopadasPorFornecedor.get(c.fornecedor_id) ?? new Set<string>();
      etapas.add(c.etapa_id);
      etapasEscopadasPorFornecedor.set(c.fornecedor_id, etapas);
    }

    function pagoDoContrato(contrato: { fornecedor_id: string; etapa_id: string | null }): number {
      if (contrato.etapa_id) {
        return pagoPorFornecedorEEtapa.get(`${contrato.fornecedor_id}::${contrato.etapa_id}`) ?? 0;
      }
      const etapasEscopadas = etapasEscopadasPorFornecedor.get(contrato.fornecedor_id);
      if (!etapasEscopadas || etapasEscopadas.size === 0) {
        return pagoPorFornecedor.get(contrato.fornecedor_id) ?? 0;
      }
      return despesasObra.reduce((soma, d) => {
        if (d.fornecedor_id !== contrato.fornecedor_id) return soma;
        if (d.etapa_id && etapasEscopadas.has(d.etapa_id)) return soma;
        return soma + d.valor;
      }, 0);
    }

    for (const contrato of contratosObra) {
      const pago = pagoDoContrato(contrato);
      if (pago > contrato.valor_contrato) {
        const obraNome = nomesObra.get(obraId) ?? "Obra";
        const fornecedorNome = nomesFornecedor.get(contrato.fornecedor_id) ?? "Fornecedor";
        alertas.push({
          tipo: "orcamento_estourado",
          obraNome,
          mensagem: `${fornecedorNome} / ${obraNome} — ${formatBRL(pago - contrato.valor_contrato)} acima`,
        });
      }
    }
  }
  return alertas;
}

async function buscarSaldosNegativos(): Promise<Alerta[]> {
  const supabase = createAdminClient();

  const [{ data: contas }, { data: despesas }] = await Promise.all([
    supabase.from("contas_bancarias").select("id, nome, saldo_inicial").is("deleted_at", null),
    supabase
      .from("despesas")
      .select("conta_bancaria_id, valor")
      .is("deleted_at", null)
      .not("conta_bancaria_id", "is", null),
  ]);
  if (!contas || contas.length === 0) return [];

  const gastoPorConta = new Map<string, number>();
  for (const d of despesas ?? []) {
    if (!d.conta_bancaria_id) continue;
    gastoPorConta.set(d.conta_bancaria_id, (gastoPorConta.get(d.conta_bancaria_id) ?? 0) + Number(d.valor));
  }

  const alertas: Alerta[] = [];
  for (const conta of contas) {
    const saldoAtual = Number(conta.saldo_inicial) - (gastoPorConta.get(conta.id) ?? 0);
    if (saldoAtual < 0) {
      alertas.push({
        tipo: "saldo_negativo",
        obraNome: null,
        mensagem: `${conta.nome} — ${formatBRL(saldoAtual)}`,
      });
    }
  }
  return alertas;
}

/**
 * Cada regra roda isolada - se uma tabela ainda nao existir (migration nao
 * aplicada) ou a consulta falhar, essa categoria fica vazia em vez de
 * derrubar o alerta diario inteiro.
 */
async function buscarComGraceful(nome: string, fn: () => Promise<Alerta[]>): Promise<Alerta[]> {
  try {
    return await fn();
  } catch (error) {
    console.error(`Erro ao buscar alertas de ${nome}:`, error);
    return [];
  }
}

export async function buscarAlertas(): Promise<Alerta[]> {
  const [etapas, contratos, saldos] = await Promise.all([
    buscarComGraceful("etapa_atrasada", buscarEtapasAtrasadas),
    buscarComGraceful("orcamento_estourado", buscarContratosEstourados),
    buscarComGraceful("saldo_negativo", buscarSaldosNegativos),
  ]);
  return [...etapas, ...contratos, ...saldos];
}
