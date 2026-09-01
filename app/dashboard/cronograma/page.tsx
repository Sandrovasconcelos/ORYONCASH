import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { calcularCurvaS } from "@/lib/dashboard/queries";
import {
  createContratoFornecedorAction,
  deleteContratoFornecedorAction,
  excluirArquivoContratoAction,
  updateContratoFornecedorAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";
import { ObraSelector } from "../obra-selector";
import { CronogramaTabs } from "./cronograma-tabs";
import { DistribuicaoMensalTable } from "./distribuicao-mensal-table";
import { CurvaSChart } from "../charts/curva-s-chart";
import { ContratoFornecedorForm } from "./contrato-fornecedor-form";

export const dynamic = "force-dynamic";

type EtapaCronograma = {
  id: string;
  nome: string;
  obra_id: string;
  valor_orcado: number;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  percentual_executado: number;
};

function KpiTile({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-brand-sm border border-brand-gray-300/60 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gray-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-brand-black">{valor}</p>
    </div>
  );
}

export default async function CronogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const [{ data: obras }, { data: fornecedores }, { data: categorias }, etapasQuery] = await Promise.all([
    supabase
      .from("obras")
      .select("id, nome, status, orcamento_total")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("categorias").select("id, nome").is("deleted_at", null).order("nome"),
    supabase
      .from("etapas")
      .select("id, nome, obra_id, valor_orcado, data_inicio_prevista, data_fim_prevista, percentual_executado")
      .is("deleted_at", null)
      .order("ordem"),
  ]);

  const listaObras = obras ?? [];
  const obraAtual = listaObras.find((o) => o.id === params.obra) ?? listaObras[0] ?? null;

  const moduloIndisponivel = Boolean(etapasQuery.error);
  const listaFornecedores = fornecedores ?? [];
  const nomesFornecedor = new Map(listaFornecedores.map((f) => [f.id, f.nome]));
  const listaCategoriasContrato = categorias ?? [];
  const nomesCategoria = new Map(listaCategoriasContrato.map((c) => [c.id, c.nome]));

  if (moduloIndisponivel) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Módulo de cronograma ainda não ativado no Supabase.</p>
        <p className="mt-1">
          Aplique a migration <code>20260803000000_cronograma_e_medicoes.sql</code> pra liberar
          datas previstas, % executado e medições.
        </p>
      </div>
    );
  }

  const todasEtapas = (etapasQuery.data ?? []) as EtapaCronograma[];
  const etapas = obraAtual ? todasEtapas.filter((e) => e.obra_id === obraAtual.id) : [];

  let despesasObra: {
    valor: number;
    data: string;
    fornecedor_id: string | null;
    etapa_id: string | null;
    categoria_id: string | null;
  }[] = [];
  let contratosObra: {
    id: string;
    obra_id: string;
    fornecedor_id: string;
    etapa_id: string | null;
    categoria_id: string | null;
    descricao: string | null;
    valor_contrato: number;
    arquivo_storage_path: string | null;
    arquivo_nome: string | null;
    arquivo_url: string | null;
  }[] = [];
  if (obraAtual) {
    const [{ data: despesasData }, contratosQuery] = await Promise.all([
      supabase
        .from("despesas")
        .select("valor, data, fornecedor_id, etapa_id, categoria_id")
        .eq("obra_id", obraAtual.id)
        .is("deleted_at", null),
      (async () => {
        const comCategoria = await supabase
          .from("contratos_fornecedor")
          .select(
            "id, obra_id, fornecedor_id, etapa_id, categoria_id, descricao, valor_contrato, arquivo_storage_path, arquivo_nome"
          )
          .eq("obra_id", obraAtual.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (!comCategoria.error) return comCategoria;
        // categoria_id pode ainda nao existir se a migration nao rodou.
        const completa = await supabase
          .from("contratos_fornecedor")
          .select(
            "id, obra_id, fornecedor_id, etapa_id, descricao, valor_contrato, arquivo_storage_path, arquivo_nome"
          )
          .eq("obra_id", obraAtual.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (!completa.error) return completa;
        // arquivo_* pode ainda nao existir se a migration nao rodou.
        const comEtapa = await supabase
          .from("contratos_fornecedor")
          .select("id, obra_id, fornecedor_id, etapa_id, descricao, valor_contrato")
          .eq("obra_id", obraAtual.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (!comEtapa.error) return comEtapa;
        // etapa_id tambem pode ainda nao existir.
        return supabase
          .from("contratos_fornecedor")
          .select("id, obra_id, fornecedor_id, descricao, valor_contrato")
          .eq("obra_id", obraAtual.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
      })(),
    ]);
    despesasObra = (despesasData ?? []).map((d) => ({
      ...d,
      categoria_id: (d as { categoria_id?: string | null }).categoria_id ?? null,
    }));
    contratosObra = await Promise.all(
      (contratosQuery.data ?? []).map(async (c) => {
        const contratoInfo = c as unknown as {
          id: string;
          obra_id: string;
          fornecedor_id: string;
          etapa_id?: string | null;
          categoria_id?: string | null;
          descricao: string | null;
          valor_contrato: number;
          arquivo_storage_path?: string | null;
          arquivo_nome?: string | null;
        };
        let arquivoUrl: string | null = null;
        if (contratoInfo.arquivo_storage_path) {
          const { data: signed } = await supabase.storage
            .from("comprovantes")
            .createSignedUrl(contratoInfo.arquivo_storage_path, 60 * 60);
          arquivoUrl = signed?.signedUrl ?? null;
        }
        return {
          ...contratoInfo,
          etapa_id: contratoInfo.etapa_id ?? null,
          categoria_id: contratoInfo.categoria_id ?? null,
          arquivo_storage_path: contratoInfo.arquivo_storage_path ?? null,
          arquivo_nome: contratoInfo.arquivo_nome ?? null,
          arquivo_url: arquivoUrl,
        };
      })
    );
  }

  let distribuicoesMensais: {
    etapaId: string;
    mes: string;
    percentual: number;
    duracaoDias: number;
    observacao: string | null;
  }[] = [];
  if (etapas.length > 0) {
    const { data: distribuicaoData } = await supabase
      .from("etapa_distribuicao_mensal")
      .select("etapa_id, mes, percentual, duracao_dias, observacao")
      .in(
        "etapa_id",
        etapas.map((e) => e.id)
      );
    distribuicoesMensais = (distribuicaoData ?? []).map((d) => ({
      etapaId: d.etapa_id,
      mes: d.mes,
      percentual: Number(d.percentual),
      duracaoDias: d.duracao_dias,
      observacao: d.observacao,
    }));
  }

  const mesesCronograma: string[] = (() => {
    const datas = etapas
      .flatMap((e) => [e.data_inicio_prevista, e.data_fim_prevista])
      .filter((d): d is string => Boolean(d));
    if (datas.length === 0) return [];
    const inicio = datas.reduce((min, d) => (d < min ? d : min));
    const fim = datas.reduce((max, d) => (d > max ? d : max));
    const [anoIni, mesIni] = inicio.split("-").map(Number);
    const [anoFim, mesFim] = fim.split("-").map(Number);
    const lista: string[] = [];
    let ano = anoIni;
    let mes = mesIni;
    while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
      lista.push(`${ano}-${String(mes).padStart(2, "0")}-01`);
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
    }
    return lista;
  })();

  const nomesEtapa = new Map(todasEtapas.map((e) => [e.id, e.nome]));

  const etapasEscopadasPorFornecedor = new Map<string, Set<string>>();
  for (const c of contratosObra) {
    if (!c.etapa_id) continue;
    const etapasDoFornecedor = etapasEscopadasPorFornecedor.get(c.fornecedor_id) ?? new Set<string>();
    etapasDoFornecedor.add(c.etapa_id);
    etapasEscopadasPorFornecedor.set(c.fornecedor_id, etapasDoFornecedor);
  }

  // Quando etapa E categoria estao definidas, uma despesa conta se bater
  // com QUALQUER uma das duas (OU, nao E) - ex: uma compra de equipamento
  // pro Alex pode estar na etapa "Mao de Obra Alex" mas na categoria
  // "Compra de Equipamentos", e ainda assim deve contar pro contrato dele.
  // Com so uma das duas definida, so ela decide. O fornecedor NUNCA entra
  // na conta quando etapa ou categoria estao definidos - o usuario lanca
  // pagamento de mao de obra por etapa/categoria, sem preencher o
  // fornecedor em todo lancamento (material comprado em loja fica com o
  // fornecedor da loja, nao do trabalhador).
  //
  // Sem etapa nem categoria, cai no comportamento por fornecedor: soma
  // tudo do fornecedor nesta obra, excluindo despesas cuja etapa ja esteja
  // "reivindicada" por outro contrato etapa-scoped do mesmo fornecedor.
  function pagoDoContrato(contrato: {
    fornecedor_id: string;
    etapa_id: string | null;
    categoria_id: string | null;
  }): number {
    if (contrato.etapa_id || contrato.categoria_id) {
      return despesasObra.reduce((soma, d) => {
        const bateEtapa = Boolean(contrato.etapa_id) && d.etapa_id === contrato.etapa_id;
        const bateCategoria = Boolean(contrato.categoria_id) && d.categoria_id === contrato.categoria_id;
        if (!bateEtapa && !bateCategoria) return soma;
        return soma + d.valor;
      }, 0);
    }

    const etapasEscopadas = etapasEscopadasPorFornecedor.get(contrato.fornecedor_id);
    return despesasObra.reduce((soma, d) => {
      if (d.fornecedor_id !== contrato.fornecedor_id) return soma;
      if (etapasEscopadas && d.etapa_id && etapasEscopadas.has(d.etapa_id)) return soma;
      return soma + d.valor;
    }, 0);
  }

  const orcamentoTotalObra = Number(obraAtual?.orcamento_total ?? 0);
  const executadoFinanceiro = despesasObra.reduce((soma, d) => soma + d.valor, 0);
  const percentualFisico =
    orcamentoTotalObra > 0
      ? Math.round(
          (etapas.reduce((soma, e) => soma + (e.valor_orcado ?? 0) * (e.percentual_executado / 100), 0) /
            orcamentoTotalObra) *
            100
        )
      : 0;

  const curvaSPontos = calcularCurvaS(
    etapas.map((e) => ({
      valorOrcado: e.valor_orcado ?? 0,
      dataInicioPrevista: e.data_inicio_prevista,
      dataFimPrevista: e.data_fim_prevista,
    })),
    despesasObra
  );

  const visaoGeralPanel = !obraAtual ? (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-10 text-center text-sm text-brand-gray-500 shadow-card">
      Cadastre uma obra primeiro.
    </div>
  ) : (
    <div className="flex flex-col gap-6">
      <ObraSelector obras={listaObras} obraAtualId={obraAtual.id} basePath="/dashboard/cronograma" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiTile label="Orçamento total" valor={formatBRL(orcamentoTotalObra)} />
        <KpiTile label="Executado (financeiro)" valor={formatBRL(executadoFinanceiro)} />
        <KpiTile label="% físico médio" valor={`${percentualFisico}%`} />
      </div>

      <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
        <p className="mb-1 text-sm font-semibold text-brand-black">Curva S — previsto x realizado</p>
        <p className="mb-2 text-xs text-brand-gray-500">
          Previsto distribui o orçamento entre as datas previstas de cada etapa. Realizado soma as
          despesas lançadas.
        </p>
        <CurvaSChart pontos={curvaSPontos} />
      </div>

      <div className="rounded-brand-sm border border-status-info/25 bg-status-info/5 p-4 text-xs text-brand-gray-700">
        Progresso e materiais por etapa agora ficam em{" "}
        <Link href="/dashboard/execucao" className="font-bold text-status-info hover:underline">
          Execução →
        </Link>
      </div>

      <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-brand-gray-300/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-black">Contratos de fornecedores</p>
            <p className="mt-1 text-xs text-brand-gray-500">
              Valor contratado x já pago. Definindo etapa e/ou categoria (ex: &quot;Mão de Obra
              Alex&quot;), conta todo lançamento que bater com qualquer uma das duas — ignora o
              fornecedor do lançamento. Sem etapa nem categoria, soma por fornecedor.
            </p>
          </div>
          <CadastroModal
            titulo="Novo contrato de fornecedor"
            descricao="Ex: Pintura — José, R$ 12.000,00."
            botao="+ Novo contrato"
            variante="primario"
          >
            <ContratoFornecedorForm
              action={createContratoFornecedorAction}
              obras={listaObras}
              obraIdPadrao={obraAtual.id}
              todasEtapas={todasEtapas}
              categorias={listaCategoriasContrato}
              fornecedores={listaFornecedores}
            />
          </CadastroModal>
        </div>

        <div className="overflow-x-auto">
          <table className="oc-table min-w-[960px]">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Etapa</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Arquivo</th>
                <th className="text-right">Contrato</th>
                <th className="text-right">Pago</th>
                <th className="text-right">Saldo</th>
                <th>%</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contratosObra.map((contrato) => {
                const pago = pagoDoContrato(contrato);
                const saldo = contrato.valor_contrato - pago;
                const percentual =
                  contrato.valor_contrato > 0
                    ? Math.round((pago / contrato.valor_contrato) * 100)
                    : 0;
                const estourou = pago > contrato.valor_contrato;
                return (
                  <tr key={contrato.id}>
                    <td className="font-semibold text-brand-black">
                      {nomesFornecedor.get(contrato.fornecedor_id) ?? "—"}
                    </td>
                    <td className="text-brand-gray-700">
                      {contrato.etapa_id ? (
                        nomesEtapa.get(contrato.etapa_id) ?? "—"
                      ) : (
                        <span className="inline-flex w-fit rounded-full bg-brand-gray-100 px-2 py-0.5 text-[11px] font-bold text-brand-gray-500">
                          Geral
                        </span>
                      )}
                    </td>
                    <td className="text-brand-gray-700">
                      {contrato.categoria_id ? nomesCategoria.get(contrato.categoria_id) ?? "—" : "—"}
                    </td>
                    <td className="text-brand-gray-700">{contrato.descricao || "—"}</td>
                    <td>
                      {contrato.arquivo_url ? (
                        <Link
                          href={contrato.arquivo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-brand-sm border border-status-info/25 bg-white text-status-info hover:bg-status-info hover:text-white"
                          aria-label={`Ver contrato de ${nomesFornecedor.get(contrato.fornecedor_id) ?? "fornecedor"}`}
                          title={contrato.arquivo_nome ?? "Ver arquivo"}
                        >
                          <ActionIcon name="file" />
                        </Link>
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-brand-sm border border-brand-gray-300 bg-brand-gray-100 text-brand-gray-500">
                          <ActionIcon name="file" />
                        </span>
                      )}
                    </td>
                    <td className="text-right text-brand-gray-700">{formatBRL(contrato.valor_contrato)}</td>
                    <td className="text-right text-brand-gray-700">{formatBRL(pago)}</td>
                    <td className={`text-right ${estourou ? "font-bold text-status-danger" : "text-brand-gray-700"}`}>
                      {formatBRL(saldo)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-brand-gray-100">
                          <div
                            className={`h-full rounded-full ${estourou ? "bg-status-danger" : "bg-[color:var(--status-success)]"}`}
                            style={{ width: `${Math.min(100, percentual)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-brand-gray-700">{percentual}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <CadastroModal
                          titulo="Editar contrato"
                          descricao="Atualize obra, fornecedor, etapa/categoria e valor."
                          botao="Editar"
                          icone={<ActionIcon name="edit" />}
                          variante="icone"
                        >
                          <ContratoFornecedorForm
                            action={updateContratoFornecedorAction}
                            obras={listaObras}
                            todasEtapas={todasEtapas}
                            categorias={listaCategoriasContrato}
                            fornecedores={listaFornecedores}
                            contrato={contrato}
                            onExcluirArquivoAction={excluirArquivoContratoAction}
                          />
                        </CadastroModal>

                        <DeleteCadastroButton
                          id={contrato.id}
                          nome={`Contrato de ${nomesFornecedor.get(contrato.fornecedor_id) ?? "fornecedor"}`}
                          entidade="Contrato de fornecedor"
                          usadoEm={0}
                          action={deleteContratoFornecedorAction}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {contratosObra.length === 0 && (
                <tr>
                  <td colSpan={9} className="oc-empty">
                    Nenhum contrato cadastrado pra esta obra ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const fisicoFinanceiroPanel = !obraAtual ? (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-10 text-center text-sm text-brand-gray-500 shadow-card">
      Cadastre uma obra primeiro.
    </div>
  ) : etapas.length === 0 ? (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ObraSelector obras={listaObras} obraAtualId={obraAtual.id} basePath="/dashboard/cronograma" />
      </div>
      <div className="rounded-card border border-brand-gray-300/60 bg-white p-8 text-center shadow-card">
        <p className="text-sm font-semibold text-brand-black">
          Nenhuma etapa foi adicionada ao cronograma.
        </p>
        <p className="mt-1 text-xs text-brand-gray-500">
          Cadastre etapas com valor orçado pra {obraAtual.nome} na aba Visão geral.
        </p>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ObraSelector obras={listaObras} obraAtualId={obraAtual.id} basePath="/dashboard/cronograma" />
      </div>
      <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
        <DistribuicaoMensalTable
          etapas={etapas.map((e) => ({ id: e.id, nome: e.nome, valorOrcado: e.valor_orcado ?? 0 }))}
          meses={mesesCronograma}
          distribuicoes={distribuicoesMensais}
        />
      </div>
    </div>
  );

  return <CronogramaTabs visaoGeralPanel={visaoGeralPanel} fisicoFinanceiroPanel={fisicoFinanceiroPanel} />;
}
