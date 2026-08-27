import { createAdminClient } from "@/lib/supabase/admin";
import { createDespesa, hojeNoBrasil } from "@/lib/conversation/queries";

export type Recorrencia = "nenhuma" | "semanal" | "mensal";

/**
 * Proxima ocorrencia de uma conta recorrente. Semanal soma 7 dias corridos;
 * mensal mantem o mesmo dia no mes seguinte (se o mes seguinte for mais
 * curto, o JS já rola pro dia certo sozinho - ex: 31/01 + 1 mes = 03/03,
 * comportamento aceito aqui por simplicidade).
 */
export function proximaData(dataVencimento: string, recorrencia: Recorrencia): string | null {
  if (recorrencia === "nenhuma") return null;

  const [ano, mes, dia] = dataVencimento.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));

  if (recorrencia === "semanal") {
    data.setUTCDate(data.getUTCDate() + 7);
  } else {
    data.setUTCMonth(data.getUTCMonth() + 1);
  }

  return data.toISOString().slice(0, 10);
}

export async function criarContaAPagar(input: {
  descricao: string;
  valor: number;
  dataVencimento: string;
  obraId: string | null;
  recorrencia: Recorrencia;
  avisarDiasAntes: number;
  arquivo?: { bucket: string; path: string; mimeType: string; nomeArquivo: string | null } | null;
  criadoPor?: string | null;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contas_a_pagar")
    .insert({
      descricao: input.descricao,
      valor: input.valor,
      data_vencimento: input.dataVencimento,
      obra_id: input.obraId,
      recorrencia: input.recorrencia,
      avisar_dias_antes: input.avisarDiasAntes,
      storage_bucket: input.arquivo?.bucket ?? null,
      storage_path: input.arquivo?.path ?? null,
      nome_arquivo: input.arquivo?.nomeArquivo ?? null,
      created_by: input.criadoPor ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Falha ao criar conta a pagar pelo WhatsApp:", error);
    return null;
  }
  return data.id;
}

export async function marcarContaAPagarComoPaga(input: {
  contaId: string;
  comprovante?: {
    bucket: string;
    path: string;
    mimeType: string;
    nomeArquivo: string | null;
  } | null;
  autorTelefone?: string | null;
  autorNome?: string | null;
}): Promise<{ despesaId: string; proximaOcorrenciaId: string | null } | null> {
  const supabase = createAdminClient();
  const { data: conta } = await supabase
    .from("contas_a_pagar")
    .select("*")
    .eq("id", input.contaId)
    .maybeSingle();

  if (!conta || conta.status === "pago") return null;

  const despesa = await createDespesa({
    obraId: conta.obra_id,
    categoriaId: conta.categoria_id ?? (await categoriaAdministrativaFallback()),
    etapaId: conta.etapa_id,
    valor: conta.valor,
    descricao: conta.descricao,
    fornecedorId: conta.fornecedor_id,
    criadoPorTelefone: input.autorTelefone ?? null,
    criadoPorNome: input.autorNome ?? null,
    documentoAnexado: input.comprovante ? "comprovante_pagamento" : null,
  });

  if (input.comprovante) {
    await supabase.from("despesa_comprovantes").insert({
      despesa_id: despesa.id,
      tipo_documento: "comprovante_pagamento",
      storage_bucket: input.comprovante.bucket,
      storage_path: input.comprovante.path,
      mime_type: input.comprovante.mimeType,
      nome_arquivo: input.comprovante.nomeArquivo,
      origem: "dashboard",
    });
  }

  await supabase
    .from("contas_a_pagar")
    .update({ status: "pago", despesa_id: despesa.id, pago_em: new Date().toISOString() })
    .eq("id", input.contaId);

  let proximaOcorrenciaId: string | null = null;
  const proxima = proximaData(conta.data_vencimento, conta.recorrencia);
  if (proxima) {
    const { data: novaConta } = await supabase
      .from("contas_a_pagar")
      .insert({
        descricao: conta.descricao,
        valor: conta.valor,
        categoria_id: conta.categoria_id,
        obra_id: conta.obra_id,
        etapa_id: conta.etapa_id,
        fornecedor_id: conta.fornecedor_id,
        contrato_fornecedor_id: conta.contrato_fornecedor_id,
        data_vencimento: proxima,
        recorrencia: conta.recorrencia,
        avisar_dias_antes: conta.avisar_dias_antes,
        created_by: conta.created_by,
      })
      .select("id")
      .single();
    proximaOcorrenciaId = novaConta?.id ?? null;
  }

  return { despesaId: despesa.id, proximaOcorrenciaId };
}

async function categoriaAdministrativaFallback(): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("categorias")
    .select("id")
    .ilike("nome", "%administrativa%")
    .limit(1)
    .maybeSingle();
  if (data) return data.id;

  const { data: qualquer } = await supabase.from("categorias").select("id").limit(1).maybeSingle();
  if (!qualquer) throw new Error("Nenhuma categoria cadastrada - impossível lançar despesa.");
  return qualquer.id;
}

export type ContaAPagarComVencimento = {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  avisar_dias_antes: number;
  obra_nome: string | null;
};

/**
 * Contas pendentes que estao dentro da janela de aviso de CADA UMA
 * (avisar_dias_antes e configuravel por conta) ou ja vencidas - usado pelo
 * cron diario. Nao filtra por avisar_dias_antes na query (SQL nao compara
 * bem "hoje + N dias" com N sendo uma coluna variavel de forma simples via
 * supabase-js), entao busca tudo que vence nos proximos 30 dias e filtra em
 * memoria.
 */
export async function buscarContasParaAvisar(): Promise<{
  vencendo: ContaAPagarComVencimento[];
  vencidas: ContaAPagarComVencimento[];
}> {
  const supabase = createAdminClient();
  const hoje = hojeNoBrasil();
  const limite = new Date(`${hoje}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 30);

  const { data } = await supabase
    .from("contas_a_pagar")
    .select("id, descricao, valor, data_vencimento, avisar_dias_antes, obras(nome)")
    .eq("status", "pendente")
    .lte("data_vencimento", limite.toISOString().slice(0, 10))
    .order("data_vencimento");

  const vencendo: ContaAPagarComVencimento[] = [];
  const vencidas: ContaAPagarComVencimento[] = [];

  for (const conta of data ?? []) {
    const diasParaVencer = diffDias(conta.data_vencimento, hoje);
    const item: ContaAPagarComVencimento = {
      id: conta.id,
      descricao: conta.descricao,
      valor: conta.valor,
      data_vencimento: conta.data_vencimento,
      avisar_dias_antes: conta.avisar_dias_antes,
      obra_nome: (conta as unknown as { obras: { nome: string } | null }).obras?.nome ?? null,
    };

    if (diasParaVencer < 0) {
      vencidas.push(item);
    } else if (diasParaVencer <= conta.avisar_dias_antes) {
      vencendo.push(item);
    }
  }

  return { vencendo, vencidas };
}

function diffDias(dataVencimento: string, hoje: string): number {
  const a = new Date(`${dataVencimento}T00:00:00Z`).getTime();
  const b = new Date(`${hoje}T00:00:00Z`).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}
