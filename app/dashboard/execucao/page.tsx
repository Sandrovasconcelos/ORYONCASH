import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { calcularItensElegiveisParaMedicao } from "@/lib/dashboard/queries";
import {
  apagarMedicaoAction,
  aprovarEPagarMedicaoAction,
  atualizarProgressoEtapaAction,
  createChecklistItemAction,
  createChecklistTemplateAction,
  deleteChecklistItemAction,
  deleteChecklistTemplateAction,
  iniciarInspecaoAction,
  prepararMedicaoAction,
  updateChecklistTemplateAction,
  updateMedicaoAction,
  vincularChecklistEtapaAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";
import { ObraSelector } from "../obra-selector";
import { SubmitButton } from "../submit-button";
import { LiberarPagamentoForm } from "./liberar-pagamento-form";

export const dynamic = "force-dynamic";

type EtapaExecucao = {
  id: string;
  nome: string;
  obra_id: string;
  valor_orcado: number;
  fornecedor_id: string | null;
  situacao_qualidade: string;
  checklist_template_id: string | null;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  percentual_executado: number;
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

function formatDataHoraBR(iso: string): string {
  const data = new Date(iso);
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function KpiTile({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-brand-sm border border-brand-gray-300/60 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${destaque ? "text-brand-red" : "text-brand-black"}`}>
        {valor}
      </p>
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

  const [{ data: obras }, { data: fornecedores }, { data: categorias }, templatesQuery] = await Promise.all([
    supabase
      .from("obras")
      .select("id, nome, status, orcamento_total, categoria_medicao_padrao_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("categorias").select("id, nome").order("nome"),
    supabase
      .from("checklist_templates")
      .select("id, nome, descricao, checklist_itens(id, descricao, critico, ordem)")
      .is("deleted_at", null)
      .order("nome"),
  ]);

  const listaObras = obras ?? [];
  const obraAtual = listaObras.find((o) => o.id === params.obra) ?? listaObras[0] ?? null;
  const listaFornecedores = fornecedores ?? [];
  const listaCategorias = categorias ?? [];
  const nomesFornecedor = new Map(listaFornecedores.map((f) => [f.id, f.nome]));

  const moduloIndisponivel = Boolean(templatesQuery.error);
  const templates = (templatesQuery.data ?? []).map((t) => ({
    ...t,
    checklist_itens: [...(t.checklist_itens ?? [])].sort((a, b) => a.ordem - b.ordem),
  }));
  const templatesPorId = new Map(templates.map((t) => [t.id, t]));

  if (moduloIndisponivel) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Módulo de execução ainda não ativado no Supabase.</p>
        <p className="mt-1">
          Aplique as migrations de qualidade e cronograma pra liberar checklists, inspeções e
          liberação de pagamento por etapa.
        </p>
      </div>
    );
  }

  const modelosPanel = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-brand-sm border border-brand-gray-300/60 bg-brand-gray-100/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-brand-gray-500">Reutilizáveis entre etapas e obras.</p>
        <CadastroModal
          titulo="Novo modelo de checklist"
          descricao="Ex: Estrutura e concretagem, Instalações elétricas."
          botao="+ Cadastrar modelo"
          variante="primario"
        >
          <form action={createChecklistTemplateAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Nome
              <input name="nome" required className="oc-input" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Descrição
              <textarea name="descricao" rows={2} className="oc-input" />
            </label>
            <SubmitButton className="oc-button oc-button-primary">Salvar modelo</SubmitButton>
          </form>
        </CadastroModal>
      </div>

      <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="oc-table min-w-[720px]">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Descrição</th>
                <th>Itens</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td className="font-semibold text-brand-black">{template.nome}</td>
                  <td className="text-brand-gray-700">{template.descricao || "—"}</td>
                  <td>
                    <span className="oc-badge">{template.checklist_itens.length}</span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <CadastroModal
                        titulo="Editar modelo"
                        descricao="Atualize nome e descrição do modelo."
                        botao="Editar"
                        icone={<ActionIcon name="edit" />}
                        variante="icone"
                      >
                        <form action={updateChecklistTemplateAction} className="flex flex-col gap-4">
                          <input type="hidden" name="id" value={template.id} />
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Nome
                            <input name="nome" defaultValue={template.nome} required className="oc-input" />
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Descrição
                            <textarea
                              name="descricao"
                              defaultValue={template.descricao ?? ""}
                              rows={2}
                              className="oc-input"
                            />
                          </label>
                          <SubmitButton className="oc-button oc-button-primary">Salvar edição</SubmitButton>
                        </form>
                      </CadastroModal>

                      <CadastroModal
                        titulo={`Itens — ${template.nome}`}
                        descricao="Critérios que aparecem na inspeção deste checklist."
                        botao="Itens"
                        icone={<ActionIcon name="box" />}
                        variante="icone"
                      >
                        <div className="flex flex-col gap-5">
                          <form
                            action={createChecklistItemAction}
                            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_80px_auto]"
                          >
                            <input type="hidden" name="template_id" value={template.id} />
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Novo item
                              <input name="descricao" required placeholder="Ex: Formas firmes e limpas" className="oc-input" />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Ordem
                              <input
                                name="ordem"
                                type="number"
                                min="1"
                                defaultValue={template.checklist_itens.length + 1}
                                className="oc-input"
                              />
                            </label>
                            <label className="flex items-center gap-2 self-end pb-2 text-sm text-brand-gray-700">
                              <input type="checkbox" name="critico" className="h-4 w-4" />
                              Crítico
                            </label>
                            <SubmitButton className="oc-button oc-button-primary self-end">Adicionar</SubmitButton>
                          </form>

                          <div className="overflow-x-auto rounded-card border border-brand-gray-300/70">
                            <table className="oc-table min-w-[520px]">
                              <thead>
                                <tr>
                                  <th>Ordem</th>
                                  <th>Item</th>
                                  <th>Crítico</th>
                                  <th className="text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {template.checklist_itens.map((item) => (
                                  <tr key={item.id}>
                                    <td className="text-brand-gray-500">{item.ordem}</td>
                                    <td className="font-semibold text-brand-black">{item.descricao}</td>
                                    <td>{item.critico ? "Sim" : "Não"}</td>
                                    <td className="text-right">
                                      <DeleteCadastroButton
                                        id={item.id}
                                        nome={item.descricao}
                                        entidade="Item"
                                        usadoEm={0}
                                        action={deleteChecklistItemAction}
                                      />
                                    </td>
                                  </tr>
                                ))}
                                {template.checklist_itens.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="oc-empty">
                                      Nenhum item cadastrado ainda.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CadastroModal>

                      <DeleteCadastroButton
                        id={template.id}
                        nome={template.nome}
                        entidade="Modelo de checklist"
                        usadoEm={0}
                        action={deleteChecklistTemplateAction}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="oc-empty">
                    Nenhum modelo de checklist cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const gerenciarChecklistsBotao = (
    <CadastroModal
      titulo="Modelos de checklist"
      descricao="Reutilizáveis entre etapas e obras."
      botao="Gerenciar checklists"
      variante="secundario"
      modalSize="wide"
    >
      {modelosPanel}
    </CadastroModal>
  );

  if (!obraAtual) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-end">{gerenciarChecklistsBotao}</div>
        <div className="rounded-card border border-brand-gray-300/60 bg-white p-10 text-center text-sm text-brand-gray-500 shadow-card">
          Cadastre uma obra primeiro.
        </div>
      </div>
    );
  }

  const { data: etapasData } = await supabase
    .from("etapas")
    .select(
      "id, nome, obra_id, valor_orcado, fornecedor_id, situacao_qualidade, checklist_template_id, data_inicio_prevista, data_fim_prevista, percentual_executado"
    )
    .eq("obra_id", obraAtual.id)
    .is("deleted_at", null)
    .order("ordem");
  const etapas = (etapasData ?? []) as EtapaExecucao[];
  const idsEtapas = etapas.map((e) => e.id);

  const { data: medicoesData } = await supabase
    .from("medicoes")
    .select(
      "id, obra_id, categoria_id, periodo_inicio, periodo_fim, status, valor_total, observacao, aprovado_por, aprovado_em, pago_em"
    )
    .eq("obra_id", obraAtual.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const medicoesPeriodo = medicoesData ?? [];
  const itensPorMedicaoPeriodo = new Map<
    string,
    { id: string; etapa_id: string; fornecedor_id: string | null; percentual_medido: number; valor_medido: number }[]
  >();
  if (medicoesPeriodo.length > 0) {
    const { data: itensData } = await supabase
      .from("medicao_itens")
      .select("id, medicao_id, etapa_id, fornecedor_id, percentual_medido, valor_medido")
      .in(
        "medicao_id",
        medicoesPeriodo.map((m) => m.id)
      );
    for (const item of itensData ?? []) {
      const lista = itensPorMedicaoPeriodo.get(item.medicao_id) ?? [];
      lista.push(item);
      itensPorMedicaoPeriodo.set(item.medicao_id, lista);
    }
  }

  const jaMedidoPorEtapa = new Map<string, number>();
  const pagoPorEtapa = new Map<string, { percentual: number; valor: number }>();
  const contratoPorEtapa = new Map<string, { descricao: string | null; valorContrato: number }>();
  const inspecoesPorEtapa = new Map<
    string,
    { id: string; resultado: string; observacao: string | null; inspecionado_por: string | null; created_at: string }[]
  >();
  const liberacoesPorEtapa = new Map<
    string,
    { id: string; percentual: number; valor: number; origem: string; data: string }[]
  >();

  if (idsEtapas.length > 0) {
    const [{ data: itensTodos }, { data: contratosEtapa }, { data: inspecoesData }] = await Promise.all([
      supabase
        .from("medicao_itens")
        .select("etapa_id, percentual_medido, valor_medido, medicoes!inner(status, observacao, periodo_inicio, periodo_fim, pago_em)")
        .in("etapa_id", idsEtapas),
      supabase
        .from("contratos_fornecedor")
        .select("etapa_id, descricao, valor_contrato")
        .eq("obra_id", obraAtual.id)
        .is("deleted_at", null)
        .not("etapa_id", "is", null),
      supabase
        .from("inspecoes")
        .select("id, etapa_id, resultado, observacao, inspecionado_por, created_at")
        .in("etapa_id", idsEtapas)
        .order("created_at", { ascending: false }),
    ]);

    for (const item of (itensTodos ?? []) as unknown as {
      etapa_id: string;
      percentual_medido: number;
      valor_medido: number;
      medicoes: { status: string; observacao: string | null; periodo_inicio: string; periodo_fim: string; pago_em: string | null };
    }[]) {
      jaMedidoPorEtapa.set(item.etapa_id, (jaMedidoPorEtapa.get(item.etapa_id) ?? 0) + Number(item.percentual_medido));

      if (item.medicoes.status === "paga") {
        const atual = pagoPorEtapa.get(item.etapa_id) ?? { percentual: 0, valor: 0 };
        atual.percentual += Number(item.percentual_medido);
        atual.valor += Number(item.valor_medido);
        pagoPorEtapa.set(item.etapa_id, atual);

        const lista = liberacoesPorEtapa.get(item.etapa_id) ?? [];
        lista.push({
          id: item.etapa_id + item.medicoes.pago_em,
          percentual: Number(item.percentual_medido),
          valor: Number(item.valor_medido),
          origem: item.medicoes.observacao === "Liberação rápida" ? "Liberação rápida" : "Medição de período",
          data: item.medicoes.pago_em ?? item.medicoes.periodo_fim,
        });
        liberacoesPorEtapa.set(item.etapa_id, lista);
      }
    }

    for (const contrato of (contratosEtapa ?? []) as { etapa_id: string | null; descricao: string | null; valor_contrato: number }[]) {
      if (!contrato.etapa_id) continue;
      contratoPorEtapa.set(contrato.etapa_id, {
        descricao: contrato.descricao,
        valorContrato: Number(contrato.valor_contrato),
      });
    }

    for (const inspecao of inspecoesData ?? []) {
      const lista = inspecoesPorEtapa.get(inspecao.etapa_id) ?? [];
      lista.push(inspecao);
      inspecoesPorEtapa.set(inspecao.etapa_id, lista);
    }
  }

  const itensElegiveis = calcularItensElegiveisParaMedicao(
    etapas.map((e) => ({
      id: e.id,
      nome: e.nome,
      valorOrcado: Number(e.valor_orcado ?? 0),
      percentualExecutado: Number(e.percentual_executado),
      situacaoQualidade: e.situacao_qualidade,
      fornecedorId: e.fornecedor_id,
    })),
    jaMedidoPorEtapa
  );
  const elegivelPorEtapa = new Map(itensElegiveis.map((item) => [item.etapaId, item]));
  const totalALiberar = itensElegiveis.reduce((soma, item) => soma + item.valorMedido, 0);

  const orcamentoTotalObra = Number(obraAtual.orcamento_total ?? 0);
  const percentualFisico =
    orcamentoTotalObra > 0
      ? Math.round(
          (etapas.reduce((soma, e) => soma + (e.valor_orcado ?? 0) * (e.percentual_executado / 100), 0) /
            orcamentoTotalObra) *
            100
        )
      : 0;

  const nomesEtapaObra = new Map(etapas.map((e) => [e.id, e.nome]));
  const categoriasPorId = new Map(listaCategorias.map((c) => [c.id, c.nome]));

  const medicaoPeriodoPanel = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-brand-sm border border-brand-gray-300/60 bg-brand-gray-100/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-brand-gray-500">
          Junta várias etapas elegíveis num período só e fecha o pagamento de uma vez.
        </p>
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
              <select
                name="categoria_id"
                required
                defaultValue={obraAtual.categoria_medicao_padrao_id ?? ""}
                className="oc-input"
              >
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
            <SubmitButton className="oc-button oc-button-primary">Preparar medição</SubmitButton>
          </form>
        </CadastroModal>
      </div>

      <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="oc-table min-w-[760px]">
            <thead>
              <tr>
                <th>Período</th>
                <th>Categoria</th>
                <th>Status</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {medicoesPeriodo.map((medicao) => {
                const status = MEDICAO_STATUS_LABEL[medicao.status] ?? MEDICAO_STATUS_LABEL.preparada;
                const itens = itensPorMedicaoPeriodo.get(medicao.id) ?? [];
                return (
                  <tr key={medicao.id}>
                    <td>
                      <details>
                        <summary className="cursor-pointer font-semibold text-brand-black">
                          {formatDataBR(medicao.periodo_inicio)} a {formatDataBR(medicao.periodo_fim)}
                        </summary>
                        <div className="mt-3 max-w-md">
                          {medicao.observacao && (
                            <p className="mb-2 text-xs text-brand-gray-500">{medicao.observacao}</p>
                          )}
                          <table className="oc-table min-w-[420px]">
                            <thead>
                              <tr>
                                <th>Etapa</th>
                                <th>% medido</th>
                                <th>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itens.map((item) => (
                                <tr key={item.id}>
                                  <td className="font-semibold text-brand-black">
                                    {nomesEtapaObra.get(item.etapa_id) ?? "—"}
                                  </td>
                                  <td className="text-brand-gray-700">{Number(item.percentual_medido)}%</td>
                                  <td className="text-brand-gray-700">{formatBRL(item.valor_medido)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </td>
                    <td className="text-brand-gray-700">{categoriasPorId.get(medicao.categoria_id) ?? "—"}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${status.classe}`}>
                        {status.texto}
                      </span>
                    </td>
                    <td className="text-right font-extrabold text-brand-black">{formatBRL(medicao.valor_total)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <CadastroModal
                          titulo="Editar medição"
                          descricao="Período, categoria e observação. Não recalcula os itens já gerados."
                          botao="Editar"
                          icone={<ActionIcon name="edit" />}
                          variante="icone"
                        >
                          <form action={updateMedicaoAction} className="flex flex-col gap-4">
                            <input type="hidden" name="id" value={medicao.id} />
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Categoria
                              <select name="categoria_id" required defaultValue={medicao.categoria_id} className="oc-input">
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
                                <input
                                  type="date"
                                  name="periodo_inicio"
                                  required
                                  defaultValue={medicao.periodo_inicio}
                                  className="oc-input"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                Período — fim
                                <input
                                  type="date"
                                  name="periodo_fim"
                                  required
                                  defaultValue={medicao.periodo_fim}
                                  className="oc-input"
                                />
                              </label>
                            </div>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Observação
                              <textarea
                                name="observacao"
                                rows={2}
                                defaultValue={medicao.observacao ?? ""}
                                className="oc-input"
                              />
                            </label>
                            <SubmitButton className="oc-button oc-button-primary">Salvar edição</SubmitButton>
                          </form>
                        </CadastroModal>

                        {medicao.status === "preparada" && (
                          <form action={aprovarEPagarMedicaoAction}>
                            <input type="hidden" name="id" value={medicao.id} />
                            <SubmitButton className="oc-button oc-button-primary py-1.5 text-xs">
                              Aprovar e pagar
                            </SubmitButton>
                          </form>
                        )}
                        {medicao.status === "paga" && (
                          <span className="text-xs text-brand-gray-500">
                            Paga em {medicao.pago_em ? formatDataBR(medicao.pago_em.slice(0, 10)) : "—"}
                          </span>
                        )}
                        <DeleteCadastroButton
                          id={medicao.id}
                          nome={`Medição de ${formatBRL(medicao.valor_total)}`}
                          entidade="Medição"
                          usadoEm={medicao.status === "paga" ? 1 : 0}
                          detalhesUso={
                            medicao.status === "paga"
                              ? "Já está paga — apagar também manda a despesa gerada por ela para a lixeira."
                              : undefined
                          }
                          action={apagarMedicaoAction}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {medicoesPeriodo.length === 0 && (
                <tr>
                  <td colSpan={5} className="oc-empty">
                    Nenhuma medição preparada ainda para esta obra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const medicaoPeriodoBotao = (
    <CadastroModal
      titulo="Medições do período"
      descricao={`Fechamento em lote para ${obraAtual.nome}.`}
      botao="Medição de período"
      variante="secundario"
      modalSize="wide"
    >
      {medicaoPeriodoPanel}
    </CadastroModal>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ObraSelector obras={listaObras} obraAtualId={obraAtual.id} basePath="/dashboard/execucao" />
        <div className="flex flex-wrap items-center gap-2">
          {medicaoPeriodoBotao}
          {gerenciarChecklistsBotao}
        </div>
      </div>

      {!obraAtual.categoria_medicao_padrao_id && (
        <div className="rounded-brand-sm border border-status-warning/30 bg-status-warning/10 p-4 text-xs text-brand-gray-700">
          Esta obra ainda não tem uma <strong>categoria padrão para pagamentos de etapas</strong>{" "}
          configurada. Ao liberar um pagamento, você vai precisar escolher a categoria manualmente. Isso
          pode ser configurado no cadastro da obra, em Obras.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Orçamento total" valor={formatBRL(orcamentoTotalObra)} />
        <KpiTile label="% físico médio" valor={`${percentualFisico}%`} />
        <KpiTile label="Etapas" valor={String(etapas.length)} />
        <KpiTile label="A liberar" valor={formatBRL(totalALiberar)} destaque={totalALiberar > 0} />
      </div>

      <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="border-b border-brand-gray-300/60 px-5 py-4">
          <p className="text-sm font-semibold text-brand-black">Etapas de {obraAtual.nome}</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Qualidade, progresso e liberação de pagamento — tudo dentro de cada etapa.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="oc-table min-w-[960px]">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Fornecedor</th>
                <th>Progresso</th>
                <th>Qualidade</th>
                <th>Pago</th>
                <th className="text-right">A liberar</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((etapa) => {
                const situacao = SITUACAO_LABEL[etapa.situacao_qualidade] ?? SITUACAO_LABEL.nao_inspecionado;
                const template = etapa.checklist_template_id ? templatesPorId.get(etapa.checklist_template_id) : null;
                const pago = pagoPorEtapa.get(etapa.id) ?? { percentual: 0, valor: 0 };
                const pagoPercentual = Math.round(pago.percentual);
                const contrato = contratoPorEtapa.get(etapa.id);
                const elegivel = elegivelPorEtapa.get(etapa.id);
                const inspecoes = inspecoesPorEtapa.get(etapa.id) ?? [];
                const liberacoes = (liberacoesPorEtapa.get(etapa.id) ?? []).sort((a, b) => (a.data < b.data ? 1 : -1));

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
                    <td>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${situacao.classe}`}>
                        {situacao.texto}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-bold text-brand-gray-700">{pagoPercentual}%</span>
                      {pago.valor > 0 && (
                        <p className="text-[11px] text-brand-gray-500">{formatBRL(pago.valor)}</p>
                      )}
                    </td>
                    <td className={`text-right font-extrabold ${elegivel ? "text-brand-red" : "text-brand-gray-400"}`}>
                      {formatBRL(elegivel?.valorMedido ?? 0)}
                    </td>
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

                              <form action={vincularChecklistEtapaAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                                  Checklist vinculado
                                  <select
                                    name="checklist_template_id"
                                    defaultValue={etapa.checklist_template_id ?? ""}
                                    className="oc-input"
                                  >
                                    <option value="">Nenhum</option>
                                    {templates.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.nome}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="sm:col-span-2">
                                  <SubmitButton className="oc-button oc-button-primary">Salvar configuração</SubmitButton>
                                </div>
                              </form>

                              <form action={atualizarProgressoEtapaAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                                <div className="sm:col-span-3">
                                  <SubmitButton className="oc-button oc-button-primary">
                                    Salvar datas e progresso
                                  </SubmitButton>
                                </div>
                              </form>

                              {contrato && (
                                <p className="text-xs font-bold text-brand-red">
                                  📄 Contrato vinculado: {formatBRL(contrato.valorContrato)}
                                  {contrato.descricao ? ` — ${contrato.descricao}` : ""}
                                </p>
                              )}
                            </section>

                            {/* Seção C — Qualidade */}
                            <section className="flex flex-col gap-4 border-t border-brand-gray-300/60 pt-6">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-brand-black">Qualidade</h3>
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${situacao.classe}`}>
                                  {situacao.texto}
                                </span>
                              </div>

                              {template && template.checklist_itens.length > 0 ? (
                                <CadastroModal
                                  titulo={`Inspecionar — ${etapa.nome}`}
                                  descricao={`Checklist: ${template.nome}`}
                                  botao="Nova inspeção"
                                  variante="primario"
                                  modalSize="wide"
                                >
                                  <form action={iniciarInspecaoAction} className="flex flex-col gap-5">
                                    <input type="hidden" name="etapa_id" value={etapa.id} />
                                    <input type="hidden" name="template_id" value={template.id} />
                                    <div className="flex flex-col gap-3">
                                      {template.checklist_itens.map((item) => (
                                        <div key={item.id} className="rounded-brand-sm border border-brand-gray-300/70 p-4">
                                          <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-semibold text-brand-black">{item.descricao}</p>
                                            {item.critico && (
                                              <span className="shrink-0 rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-brand-red">
                                                Crítico
                                              </span>
                                            )}
                                          </div>
                                          <select name={`resposta_${item.id}`} defaultValue="aprovado" className="oc-input mt-2">
                                            <option value="aprovado">Aprovado</option>
                                            <option value="pendente">Pendente</option>
                                            <option value="reprovado">Reprovado</option>
                                            <option value="nao_aplica">Não se aplica</option>
                                          </select>
                                        </div>
                                      ))}
                                    </div>
                                    <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                      Observação geral
                                      <textarea name="observacao" rows={3} className="oc-input" />
                                    </label>
                                    <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                      Inspecionado por
                                      <input name="inspecionado_por" className="oc-input" />
                                    </label>
                                    <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                      Evidências (fotos)
                                      <input
                                        type="file"
                                        name="evidencia"
                                        accept="image/*,application/pdf"
                                        multiple
                                        className="block w-full rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-xs text-brand-gray-600 file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-brand-black"
                                      />
                                    </label>
                                    <SubmitButton className="oc-button oc-button-primary">Concluir inspeção</SubmitButton>
                                  </form>
                                </CadastroModal>
                              ) : (
                                <span
                                  className="w-fit rounded-brand-sm border border-brand-gray-300 bg-brand-gray-100 px-3 py-2 text-xs font-bold text-brand-gray-500"
                                  title="Vincule um checklist na Configuração antes de inspecionar"
                                >
                                  Sem checklist vinculado
                                </span>
                              )}

                              <div className="flex flex-col gap-2">
                                <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand-gray-500">
                                  Histórico de inspeções
                                </p>
                                {inspecoes.length === 0 && (
                                  <p className="text-xs text-brand-gray-500">Nenhuma inspeção realizada ainda.</p>
                                )}
                                {inspecoes.map((i) => {
                                  const label = SITUACAO_LABEL[i.resultado] ?? SITUACAO_LABEL.nao_inspecionado;
                                  return (
                                    <div key={i.id} className="rounded-brand-sm border border-brand-gray-300/60 p-3 text-xs">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 font-bold ${label.classe}`}>
                                          {label.texto}
                                        </span>
                                        <span className="text-brand-gray-500">{formatDataHoraBR(i.created_at)}</span>
                                      </div>
                                      {i.inspecionado_por && (
                                        <p className="mt-1 text-brand-gray-700">Por {i.inspecionado_por}</p>
                                      )}
                                      {i.observacao && <p className="mt-1 text-brand-gray-500">{i.observacao}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            </section>

                            {/* Seção D — Pagamento */}
                            <section className="flex flex-col gap-4 border-t border-brand-gray-300/60 pt-6">
                              <h3 className="text-sm font-extrabold text-brand-black">Pagamento</h3>
                              <p className="text-xs text-brand-gray-700">
                                Já pago: <strong>{formatBRL(pago.valor)}</strong> ({pagoPercentual}%)
                                {contrato && <> · Contrato: {formatBRL(contrato.valorContrato)}</>}
                              </p>

                              {elegivel ? (
                                <LiberarPagamentoForm
                                  etapaId={etapa.id}
                                  percentual={Math.round(elegivel.percentualMedido)}
                                  valor={elegivel.valorMedido}
                                  fornecedorNome={
                                    etapa.fornecedor_id ? nomesFornecedor.get(etapa.fornecedor_id) ?? "—" : "—"
                                  }
                                  categorias={listaCategorias}
                                  categoriaPadraoId={obraAtual.categoria_medicao_padrao_id}
                                />
                              ) : (
                                <p className="text-xs text-brand-gray-500">
                                  {etapa.situacao_qualidade !== "aprovado"
                                    ? "Qualidade pendente — inspecione a etapa e aprove antes de liberar."
                                    : !etapa.fornecedor_id
                                      ? "Nenhum fornecedor vinculado a esta etapa."
                                      : "Nenhum valor novo a liberar no momento."}
                                </p>
                              )}

                              <div className="flex flex-col gap-2">
                                <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand-gray-500">
                                  Histórico de liberações
                                </p>
                                {liberacoes.length === 0 && (
                                  <p className="text-xs text-brand-gray-500">Nenhum pagamento liberado ainda.</p>
                                )}
                                {liberacoes.map((l) => (
                                  <div
                                    key={l.id}
                                    className="flex items-center justify-between rounded-brand-sm border border-brand-gray-300/60 p-3 text-xs"
                                  >
                                    <span className="font-bold text-brand-black">{l.origem}</span>
                                    <span className="text-brand-gray-700">
                                      {l.percentual}% — {formatBRL(l.valor)}
                                    </span>
                                  </div>
                                ))}
                              </div>
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
                  <td colSpan={7} className="oc-empty">
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
