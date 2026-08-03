import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import {
  apagarMedicaoPreparadaAction,
  aprovarMedicaoAction,
  atualizarProgressoEtapaAction,
  prepararMedicaoAction,
  registrarPagamentoMedicaoAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { ActionIcon } from "../action-icon";
import { ObraSelector } from "../obra-selector";
import { CronogramaTabs } from "./cronograma-tabs";

export const dynamic = "force-dynamic";

type EtapaCronograma = {
  id: string;
  nome: string;
  obra_id: string;
  fornecedor_id: string | null;
  situacao_qualidade: string;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  percentual_executado: number;
};

type Medicao = {
  id: string;
  obra_id: string;
  categoria_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
  valor_total: number;
  observacao: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  pago_em: string | null;
};

type MedicaoItem = {
  id: string;
  medicao_id: string;
  etapa_id: string;
  fornecedor_id: string | null;
  percentual_medido: number;
  valor_medido: number;
};

const SITUACAO_LABEL: Record<string, { texto: string; classe: string }> = {
  nao_inspecionado: { texto: "Não inspecionado", classe: "bg-brand-gray-100 text-brand-gray-700" },
  aprovado: { texto: "Aprovado", classe: "bg-[#e9f8f0] text-status-success" },
  pendente: { texto: "Pendente", classe: "bg-status-warning/15 text-status-warning" },
  reprovado: { texto: "Reprovado", classe: "bg-status-danger/15 text-status-danger" },
};

const MEDICAO_STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  preparada: { texto: "Preparada", classe: "bg-brand-gray-100 text-brand-gray-700" },
  aprovada: { texto: "Aprovada", classe: "bg-status-info/15 text-status-info" },
  paga: { texto: "Paga", classe: "bg-[#e9f8f0] text-status-success" },
};

function formatDataBR(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function CronogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const { data: obras } = await supabase
    .from("obras")
    .select("id, nome, status")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const listaObras = obras ?? [];
  const obraAtual = listaObras.find((o) => o.id === params.obra) ?? listaObras[0] ?? null;

  const [{ data: fornecedores }, { data: categorias }, etapasQuery] = await Promise.all([
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("categorias").select("id, nome").order("nome"),
    supabase
      .from("etapas")
      .select(
        "id, nome, obra_id, fornecedor_id, situacao_qualidade, data_inicio_prevista, data_fim_prevista, percentual_executado"
      )
      .order("ordem"),
  ]);

  const moduloIndisponivel = Boolean(etapasQuery.error);
  const listaFornecedores = fornecedores ?? [];
  const listaCategorias = categorias ?? [];
  const nomesFornecedor = new Map(listaFornecedores.map((f) => [f.id, f.nome]));

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

  let medicoes: Medicao[] = [];
  let itensPorMedicao = new Map<string, MedicaoItem[]>();
  if (obraAtual) {
    const { data: medicoesData } = await supabase
      .from("medicoes")
      .select(
        "id, obra_id, categoria_id, periodo_inicio, periodo_fim, status, valor_total, observacao, aprovado_por, aprovado_em, pago_em"
      )
      .eq("obra_id", obraAtual.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    medicoes = (medicoesData ?? []) as Medicao[];

    if (medicoes.length > 0) {
      const { data: itensData } = await supabase
        .from("medicao_itens")
        .select("id, medicao_id, etapa_id, fornecedor_id, percentual_medido, valor_medido")
        .in(
          "medicao_id",
          medicoes.map((m) => m.id)
        );
      for (const item of (itensData ?? []) as MedicaoItem[]) {
        const lista = itensPorMedicao.get(item.medicao_id) ?? [];
        lista.push(item);
        itensPorMedicao.set(item.medicao_id, lista);
      }
    }
  }

  const nomesEtapa = new Map(todasEtapas.map((e) => [e.id, e.nome]));
  const categoriasPorId = new Map(listaCategorias.map((c) => [c.id, c.nome]));

  const cronogramaPanel = !obraAtual ? (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-10 text-center text-sm text-brand-gray-500 shadow-card">
      Cadastre uma obra primeiro.
    </div>
  ) : (
    <div className="flex flex-col gap-6">
      <ObraSelector obras={listaObras} obraAtualId={obraAtual.id} basePath="/dashboard/cronograma" />

      <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="border-b border-brand-gray-300/60 px-5 py-4">
          <p className="text-sm font-semibold text-brand-black">Etapas de {obraAtual.nome}</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Só entram em medição etapas com qualidade aprovada e % executado acima do já medido.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="oc-table min-w-[860px]">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Início previsto</th>
                <th>Fim previsto</th>
                <th>% executado</th>
                <th>Qualidade</th>
                <th>Fornecedor</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((etapa) => {
                const situacao = SITUACAO_LABEL[etapa.situacao_qualidade] ?? SITUACAO_LABEL.nao_inspecionado;
                return (
                  <tr key={etapa.id}>
                    <td className="font-semibold text-brand-black">{etapa.nome}</td>
                    <td className="text-brand-gray-700">{formatDataBR(etapa.data_inicio_prevista)}</td>
                    <td className="text-brand-gray-700">{formatDataBR(etapa.data_fim_prevista)}</td>
                    <td className="text-brand-gray-700">{Number(etapa.percentual_executado)}%</td>
                    <td>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${situacao.classe}`}>
                        {situacao.texto}
                      </span>
                    </td>
                    <td className="text-brand-gray-700">
                      {etapa.fornecedor_id ? nomesFornecedor.get(etapa.fornecedor_id) ?? "—" : "—"}
                    </td>
                    <td>
                      <div className="flex items-center justify-end">
                        <CadastroModal
                          titulo={`Atualizar progresso — ${etapa.nome}`}
                          descricao="Datas previstas e % executado no campo."
                          botao="Atualizar progresso"
                          icone={<ActionIcon name="edit" />}
                          variante="icone"
                        >
                          <form action={atualizarProgressoEtapaAction} className="flex flex-col gap-4">
                            <input type="hidden" name="etapa_id" value={etapa.id} />
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
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              % executado
                              <input
                                type="number"
                                name="percentual_executado"
                                min="0"
                                max="100"
                                step="1"
                                defaultValue={etapa.percentual_executado}
                                className="oc-input"
                              />
                            </label>
                            <button type="submit" className="oc-button oc-button-primary">
                              Salvar progresso
                            </button>
                          </form>
                        </CadastroModal>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {etapas.length === 0 && (
                <tr>
                  <td colSpan={7} className="oc-empty">
                    Nenhuma etapa cadastrada para esta obra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const medicoesPanel = !obraAtual ? (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-10 text-center text-sm text-brand-gray-500 shadow-card">
      Cadastre uma obra primeiro.
    </div>
  ) : (
    <div className="flex flex-col gap-6">
      <ObraSelector obras={listaObras} obraAtualId={obraAtual.id} basePath="/dashboard/cronograma" />

      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-black">Medições de {obraAtual.nome}</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Só mede o que estiver com qualidade aprovada e ainda não coberto por medições anteriores.
          </p>
        </div>
        <CadastroModal
          titulo="Preparar medição"
          descricao="Calcula automaticamente o que há de novo executado e aprovado no período."
          botao="+ Preparar medição"
          variante="primario"
        >
          <form action={prepararMedicaoAction} className="flex flex-col gap-4">
            <input type="hidden" name="obra_id" value={obraAtual.id} />
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Categoria (usada nas despesas geradas)
              <select name="categoria_id" required className="oc-input">
                <option value="">Selecione</option>
                {listaCategorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                Período — início
                <input type="date" name="periodo_inicio" required className="oc-input" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                Período — fim
                <input type="date" name="periodo_fim" required className="oc-input" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Observação
              <textarea name="observacao" rows={2} className="oc-input" />
            </label>
            <button type="submit" className="oc-button oc-button-primary">
              Preparar medição
            </button>
          </form>
        </CadastroModal>
      </div>

      <div className="flex flex-col gap-4">
        {medicoes.map((medicao) => {
          const status = MEDICAO_STATUS_LABEL[medicao.status] ?? MEDICAO_STATUS_LABEL.preparada;
          const itens = itensPorMedicao.get(medicao.id) ?? [];
          return (
            <div key={medicao.id} className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-brand-black">
                    {formatDataBR(medicao.periodo_inicio)} a {formatDataBR(medicao.periodo_fim)}
                  </p>
                  <p className="mt-1 text-xs text-brand-gray-500">
                    Categoria: {categoriasPorId.get(medicao.categoria_id) ?? "—"}
                    {medicao.observacao ? ` · ${medicao.observacao}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${status.classe}`}>
                    {status.texto}
                  </span>
                  <span className="text-sm font-extrabold text-brand-black">{formatBRL(medicao.valor_total)}</span>
                </div>
              </div>

              <details className="border-t border-brand-gray-300/60">
                <summary className="cursor-pointer px-5 py-3 text-xs font-bold text-brand-gray-500">
                  Itens desta medição ({itens.length})
                </summary>
                <div className="overflow-x-auto px-5 pb-4">
                  <table className="oc-table min-w-[520px]">
                    <thead>
                      <tr>
                        <th>Etapa</th>
                        <th>Fornecedor</th>
                        <th>% medido</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item) => (
                        <tr key={item.id}>
                          <td className="font-semibold text-brand-black">{nomesEtapa.get(item.etapa_id) ?? "—"}</td>
                          <td className="text-brand-gray-700">
                            {item.fornecedor_id ? nomesFornecedor.get(item.fornecedor_id) ?? "—" : "—"}
                          </td>
                          <td className="text-brand-gray-700">{Number(item.percentual_medido)}%</td>
                          <td className="text-brand-gray-700">{formatBRL(item.valor_medido)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <div className="flex items-center justify-end gap-2 border-t border-brand-gray-300/60 px-5 py-3">
                {medicao.status === "preparada" && (
                  <>
                    <form action={apagarMedicaoPreparadaAction}>
                      <input type="hidden" name="id" value={medicao.id} />
                      <button
                        type="submit"
                        className="rounded-brand-sm border border-status-danger/30 px-3 py-2 text-xs font-bold text-status-danger hover:bg-status-danger/10"
                      >
                        Apagar
                      </button>
                    </form>
                    <form action={aprovarMedicaoAction}>
                      <input type="hidden" name="id" value={medicao.id} />
                      <button type="submit" className="oc-button oc-button-primary">
                        Aprovar
                      </button>
                    </form>
                  </>
                )}
                {medicao.status === "aprovada" && (
                  <form action={registrarPagamentoMedicaoAction}>
                    <input type="hidden" name="id" value={medicao.id} />
                    <button type="submit" className="oc-button oc-button-primary">
                      Registrar pagamento
                    </button>
                  </form>
                )}
                {medicao.status === "paga" && (
                  <span className="text-xs text-brand-gray-500">
                    Paga em {medicao.pago_em ? formatDataBR(medicao.pago_em.slice(0, 10)) : "—"}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {medicoes.length === 0 && (
          <div className="oc-empty rounded-card border border-brand-gray-300/60 bg-white p-8 shadow-card">
            Nenhuma medição preparada ainda para esta obra.
          </div>
        )}
      </div>
    </div>
  );

  return <CronogramaTabs cronogramaPanel={cronogramaPanel} medicoesPanel={medicoesPanel} />;
}
