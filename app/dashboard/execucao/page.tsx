import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import {
  atualizarStatusTarefaAction,
  criarTarefaEtapaAction,
  deleteOrcamentoMaterialEtapaAction,
  deleteTarefaEtapaAction,
  salvarConfiguracaoEtapaAction,
  updateTarefaEtapaAction,
  upsertOrcamentoMaterialEtapaAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { ActionIcon } from "../action-icon";
import { ObraSelector } from "../obra-selector";
import { SubmitButton } from "../submit-button";
import { TarefaLinha } from "./tarefa-linha";

export const dynamic = "force-dynamic";

type EtapaExecucao = {
  id: string;
  nome: string;
  obra_id: string;
  valor_orcado: number;
  fornecedor_id: string | null;
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

export default async function ExecucaoPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const [{ data: obras }, { data: fornecedores }, { data: materiais }] = await Promise.all([
    supabase
      .from("obras")
      .select("id, nome, status, orcamento_total, categoria_medicao_padrao_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("materiais").select("id, nome").is("deleted_at", null).order("nome"),
  ]);

  const listaObras = obras ?? [];
  const obraAtual = listaObras.find((o) => o.id === params.obra) ?? listaObras[0] ?? null;
  const listaFornecedores = fornecedores ?? [];
  const listaMateriais = materiais ?? [];
  const nomesFornecedor = new Map(listaFornecedores.map((f) => [f.id, f.nome]));

  if (!obraAtual) {
    return (
      <div className="rounded-card border border-brand-gray-300/60 bg-white p-10 text-center text-sm text-brand-gray-500 shadow-card">
        Cadastre uma obra primeiro.
      </div>
    );
  }

  const { data: etapasData } = await supabase
    .from("etapas")
    .select("id, nome, obra_id, valor_orcado, fornecedor_id, data_inicio_prevista, data_fim_prevista, percentual_executado")
    .eq("obra_id", obraAtual.id)
    .is("deleted_at", null)
    .order("ordem");
  const etapas = (etapasData ?? []) as EtapaExecucao[];
  const idsEtapas = etapas.map((e) => e.id);

  const orcamentosPorEtapa = new Map<
    string,
    { id: string; materialId: string; materialNome: string; orcado: number; realizado: number }[]
  >();
  const contratoPorEtapa = new Map<string, { descricao: string | null; valorContrato: number }>();
  const pagoPorEtapa = new Map<string, number>();
  const tarefasPorEtapa = new Map<string, { id: string; descricao: string; status: string; ordem: number }[]>();

  if (idsEtapas.length > 0) {
    const [
      { data: orcamentosData },
      { data: despesasComQuantidade },
      { data: contratosEtapa },
      { data: despesasEtapa },
      { data: tarefasData },
    ] = await Promise.all([
      supabase
        .from("orcamento_material_etapa")
        .select("id, etapa_id, material_id, quantidade_orcada, materiais(nome)")
        .in("etapa_id", idsEtapas),
      supabase
        .from("despesas")
        .select("etapa_id, material_id, quantidade")
        .in("etapa_id", idsEtapas)
        .not("material_id", "is", null)
        .not("quantidade", "is", null)
        .is("deleted_at", null),
      supabase
        .from("contratos_fornecedor")
        .select("etapa_id, descricao, valor_contrato")
        .eq("obra_id", obraAtual.id)
        .is("deleted_at", null)
        .not("etapa_id", "is", null),
      // "Ja pago" por etapa e simplesmente a soma dos lancamentos (despesas)
      // marcados com aquela etapa - o pagamento se vincula pelo proprio
      // lancamento, sem sistema separado de medicao/liberacao.
      supabase.from("despesas").select("etapa_id, valor").in("etapa_id", idsEtapas).is("deleted_at", null),
      supabase.from("etapa_tarefas").select("id, etapa_id, descricao, status, ordem").in("etapa_id", idsEtapas).order("ordem"),
    ]);

    for (const t of tarefasData ?? []) {
      const lista = tarefasPorEtapa.get(t.etapa_id) ?? [];
      lista.push({ id: t.id, descricao: t.descricao, status: t.status, ordem: t.ordem });
      tarefasPorEtapa.set(t.etapa_id, lista);
    }

    const realizadoPorChave = new Map<string, number>();
    for (const d of despesasComQuantidade ?? []) {
      if (!d.etapa_id || !d.material_id || d.quantidade == null) continue;
      const chave = `${d.etapa_id}::${d.material_id}`;
      realizadoPorChave.set(chave, (realizadoPorChave.get(chave) ?? 0) + Number(d.quantidade));
    }

    for (const o of orcamentosData ?? []) {
      const lista = orcamentosPorEtapa.get(o.etapa_id) ?? [];
      lista.push({
        id: o.id,
        materialId: o.material_id,
        materialNome: (o.materiais as unknown as { nome: string } | null)?.nome ?? "-",
        orcado: Number(o.quantidade_orcada),
        realizado: realizadoPorChave.get(`${o.etapa_id}::${o.material_id}`) ?? 0,
      });
      orcamentosPorEtapa.set(o.etapa_id, lista);
    }

    for (const contrato of (contratosEtapa ?? []) as { etapa_id: string | null; descricao: string | null; valor_contrato: number }[]) {
      if (!contrato.etapa_id) continue;
      contratoPorEtapa.set(contrato.etapa_id, {
        descricao: contrato.descricao,
        valorContrato: Number(contrato.valor_contrato),
      });
    }

    for (const d of despesasEtapa ?? []) {
      if (!d.etapa_id) continue;
      pagoPorEtapa.set(d.etapa_id, (pagoPorEtapa.get(d.etapa_id) ?? 0) + Number(d.valor));
    }
  }

  const orcamentoTotalObra = Number(obraAtual.orcamento_total ?? 0);
  const percentualFisico =
    orcamentoTotalObra > 0
      ? Math.round(
          (etapas.reduce((soma, e) => soma + (e.valor_orcado ?? 0) * (e.percentual_executado / 100), 0) /
            orcamentoTotalObra) *
            100
        )
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ObraSelector obras={listaObras} obraAtualId={obraAtual.id} basePath="/dashboard/execucao" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiTile label="Orçamento total" valor={formatBRL(orcamentoTotalObra)} />
        <KpiTile label="% físico médio" valor={`${percentualFisico}%`} />
        <KpiTile label="Etapas" valor={String(etapas.length)} />
      </div>

      <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="border-b border-brand-gray-300/60 px-5 py-4">
          <p className="text-sm font-semibold text-brand-black">Etapas de {obraAtual.nome}</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Progresso e materiais de cada etapa. Pagamento é feito lançando a despesa normalmente com
            essa etapa selecionada.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="oc-table min-w-[820px]">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Fornecedor</th>
                <th>Progresso</th>
                <th className="text-right">Pago</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((etapa) => {
                const pago = pagoPorEtapa.get(etapa.id) ?? 0;
                const contrato = contratoPorEtapa.get(etapa.id);
                const tarefas = tarefasPorEtapa.get(etapa.id) ?? [];
                const temTarefas = tarefas.length > 0;

                return (
                  <tr key={etapa.id}>
                    <td className="font-semibold text-brand-black">{etapa.nome}</td>
                    <td className="text-brand-gray-700">
                      <p>{etapa.fornecedor_id ? nomesFornecedor.get(etapa.fornecedor_id) ?? "—" : "—"}</p>
                      {contrato && (
                        <p className="mt-1 text-[11px] font-bold text-brand-red">
                          📄 Contrato: {formatBRL(contrato.valorContrato)}
                        </p>
                      )}
                    </td>
                    <td className="text-brand-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-brand-gray-100">
                          <div
                            className="h-full rounded-full bg-[color:var(--status-success)]"
                            style={{ width: `${Number(etapa.percentual_executado)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold">{Number(etapa.percentual_executado)}%</span>
                      </div>
                    </td>
                    <td className="text-right font-extrabold text-brand-black">{formatBRL(pago)}</td>
                    <td>
                      <div className="flex items-center justify-end">
                        <CadastroModal
                          titulo={etapa.nome}
                          descricao={obraAtual.nome}
                          botao="Abrir etapa"
                          variante="primario"
                          modalSize="wide"
                        >
                          <div className="flex flex-col gap-8">
                            {/* Seção A — Configuração */}
                            <section className="flex flex-col gap-4">
                              <h3 className="text-sm font-extrabold text-brand-black">Configuração</h3>

                              <form action={salvarConfiguracaoEtapaAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <input type="hidden" name="etapa_id" value={etapa.id} />
                                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                  Fornecedor responsável
                                  <select name="fornecedor_id" defaultValue={etapa.fornecedor_id ?? ""} className="oc-input">
                                    <option value="">Nenhum</option>
                                    {listaFornecedores.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.nome}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                  % executado
                                  {temTarefas ? (
                                    <span className="oc-input flex items-center bg-brand-gray-100 text-brand-gray-500">
                                      {etapa.percentual_executado}% (calculado pelas tarefas)
                                    </span>
                                  ) : (
                                    <input
                                      type="number"
                                      name="percentual_executado"
                                      min="0"
                                      max="100"
                                      step="1"
                                      defaultValue={etapa.percentual_executado}
                                      className="oc-input"
                                    />
                                  )}
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                  Início previsto
                                  <input
                                    type="date"
                                    name="data_inicio_prevista"
                                    defaultValue={etapa.data_inicio_prevista ?? ""}
                                    className="oc-input"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                  Fim previsto
                                  <input
                                    type="date"
                                    name="data_fim_prevista"
                                    defaultValue={etapa.data_fim_prevista ?? ""}
                                    className="oc-input"
                                  />
                                </label>
                                <div className="sm:col-span-2">
                                  <SubmitButton className="oc-button oc-button-primary">Salvar</SubmitButton>
                                </div>
                              </form>

                              {contrato && (
                                <p className="text-xs font-bold text-brand-red">
                                  📄 Contrato vinculado: {formatBRL(contrato.valorContrato)}
                                  {contrato.descricao ? ` — ${contrato.descricao}` : ""}
                                </p>
                              )}
                            </section>

                            {/* Seção A.1 — Tarefas */}
                            <section className="flex flex-col gap-3 border-t border-brand-gray-300/60 pt-6">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-brand-black">Tarefas</h3>
                                {temTarefas && (
                                  <span className="text-xs font-bold text-brand-gray-500">
                                    {tarefas.filter((t) => t.status === "concluida").length}/{tarefas.length} concluídas
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col gap-2">
                                {tarefas.length === 0 && (
                                  <p className="text-xs text-brand-gray-500">Nenhuma tarefa cadastrada nesta etapa ainda.</p>
                                )}
                                {tarefas.map((tarefa) => (
                                  <TarefaLinha
                                    key={tarefa.id}
                                    tarefaId={tarefa.id}
                                    etapaId={etapa.id}
                                    descricao={tarefa.descricao}
                                    status={tarefa.status}
                                    onAtualizarStatus={atualizarStatusTarefaAction}
                                    onAtualizarDescricao={updateTarefaEtapaAction}
                                    onExcluir={deleteTarefaEtapaAction}
                                  />
                                ))}
                              </div>

                              <form action={criarTarefaEtapaAction} className="flex gap-2">
                                <input type="hidden" name="etapa_id" value={etapa.id} />
                                <input
                                  name="descricao"
                                  required
                                  placeholder="Nova tarefa"
                                  className="oc-input flex-1"
                                />
                                <SubmitButton className="oc-button oc-button-primary shrink-0">Adicionar</SubmitButton>
                              </form>
                            </section>

                            {/* Seção B — Pagamento */}
                            <section className="flex flex-col gap-3 border-t border-brand-gray-300/60 pt-6">
                              <h3 className="text-sm font-extrabold text-brand-black">Pagamento</h3>
                              <p className="text-xs text-brand-gray-700">
                                Já pago: <strong>{formatBRL(pago)}</strong>
                                {contrato && <> · Contrato: {formatBRL(contrato.valorContrato)}</>}
                              </p>
                              <p className="text-xs text-brand-gray-500">
                                Pra registrar um pagamento dessa etapa, lance a despesa normalmente
                                (WhatsApp ou dashboard) com essa etapa selecionada — ela entra na soma
                                acima automaticamente.
                              </p>
                              <Link
                                href={`/dashboard/despesas?obra=${obraAtual.id}&etapa=${etapa.id}`}
                                className="w-fit text-xs font-bold text-status-info hover:underline"
                              >
                                Ver lançamentos dessa etapa →
                              </Link>
                            </section>

                            {/* Seção C — Materiais (orçado x realizado) */}
                            <section className="flex flex-col gap-4 border-t border-brand-gray-300/60 pt-6">
                              <h3 className="text-sm font-extrabold text-brand-black">
                                Materiais — orçado x realizado
                              </h3>

                              <div className="flex flex-col gap-2">
                                {(orcamentosPorEtapa.get(etapa.id) ?? []).length === 0 && (
                                  <p className="text-xs text-brand-gray-500">
                                    Nenhum material com quantidade orçada nesta etapa ainda.
                                  </p>
                                )}
                                {(orcamentosPorEtapa.get(etapa.id) ?? []).map((o) => {
                                  const percentual = o.orcado > 0 ? Math.round((o.realizado / o.orcado) * 100) : 0;
                                  const estourou = o.realizado > o.orcado;
                                  return (
                                    <div key={o.id} className="rounded-brand-sm border border-brand-gray-300/60 p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-bold text-brand-black">{o.materialNome}</p>
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`text-xs font-bold ${estourou ? "text-status-danger" : "text-brand-gray-700"}`}
                                          >
                                            {o.realizado} / {o.orcado}
                                          </span>
                                          <form action={deleteOrcamentoMaterialEtapaAction}>
                                            <input type="hidden" name="id" value={o.id} />
                                            <button
                                              type="submit"
                                              className="text-brand-gray-400 hover:text-status-danger"
                                              title="Remover orçamento"
                                            >
                                              <ActionIcon name="trash" />
                                            </button>
                                          </form>
                                        </div>
                                      </div>
                                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-gray-100">
                                        <div
                                          className={`h-full rounded-full ${estourou ? "bg-status-danger" : "bg-[color:var(--status-success)]"}`}
                                          style={{ width: `${Math.min(100, percentual)}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <form
                                action={upsertOrcamentoMaterialEtapaAction}
                                className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]"
                              >
                                <input type="hidden" name="etapa_id" value={etapa.id} />
                                <select name="material_id" required className="oc-input">
                                  <option value="">Selecione o material</option>
                                  {listaMateriais.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.nome}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  name="quantidade_orcada"
                                  placeholder="Qtd orçada"
                                  required
                                  className="oc-input"
                                />
                                <SubmitButton className="oc-button oc-button-primary">Definir</SubmitButton>
                              </form>
                            </section>
                          </div>
                        </CadastroModal>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {etapas.length === 0 && (
                <tr>
                  <td colSpan={5} className="oc-empty">
                    Nenhuma etapa cadastrada para esta obra.{" "}
                    <Link href="/dashboard/obras" className="font-bold text-brand-red hover:underline">
                      Cadastrar em Obras →
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
