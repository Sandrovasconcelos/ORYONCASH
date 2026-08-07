import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import {
  createChecklistItemAction,
  createChecklistTemplateAction,
  deleteChecklistItemAction,
  deleteChecklistTemplateAction,
  iniciarInspecaoAction,
  updateChecklistTemplateAction,
  vincularChecklistEtapaAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";
import { ObraSelector } from "../obra-selector";
import { QualidadeTabs } from "./qualidade-tabs";
import { SubmitButton } from "../submit-button";

export const dynamic = "force-dynamic";

type EtapaQualidade = {
  id: string;
  nome: string;
  obra_id: string;
  fornecedor_id: string | null;
  situacao_qualidade: string;
  checklist_template_id: string | null;
};

const SITUACAO_LABEL: Record<string, { texto: string; classe: string }> = {
  nao_inspecionado: { texto: "Não inspecionado", classe: "bg-brand-gray-100 text-brand-gray-700" },
  aprovado: { texto: "Aprovado", classe: "bg-[#e9f8f0] text-status-success" },
  pendente: { texto: "Pendente", classe: "bg-status-warning/15 text-status-warning" },
  reprovado: { texto: "Reprovado", classe: "bg-status-danger/15 text-status-danger" },
};

export default async function QualidadePage({
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

  const [{ data: fornecedores }, templatesQuery] = await Promise.all([
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null).order("nome"),
    supabase
      .from("checklist_templates")
      .select("id, nome, descricao, checklist_itens(id, descricao, critico, ordem)")
      .is("deleted_at", null)
      .order("nome"),
  ]);

  const moduloIndisponivel = Boolean(templatesQuery.error);
  const templates = (templatesQuery.data ?? []).map((t) => ({
    ...t,
    checklist_itens: [...(t.checklist_itens ?? [])].sort((a, b) => a.ordem - b.ordem),
  }));
  const listaFornecedores = fornecedores ?? [];

  let etapas: EtapaQualidade[] = [];
  const pagoPorEtapa = new Map<string, { percentual: number; valor: number }>();
  const contratoPorEtapa = new Map<string, { descricao: string | null; valorContrato: number }>();
  if (obraAtual && !moduloIndisponivel) {
    const { data } = await supabase
      .from("etapas")
      .select("id, nome, obra_id, fornecedor_id, situacao_qualidade, checklist_template_id")
      .eq("obra_id", obraAtual.id)
      .order("ordem");
    etapas = (data ?? []) as EtapaQualidade[];

    if (etapas.length > 0) {
      const { data: itensPagos } = await supabase
        .from("medicao_itens")
        .select("etapa_id, percentual_medido, valor_medido, medicoes!inner(status)")
        .in(
          "etapa_id",
          etapas.map((e) => e.id)
        )
        .eq("medicoes.status", "paga");

      for (const item of itensPagos ?? []) {
        const atual = pagoPorEtapa.get(item.etapa_id) ?? { percentual: 0, valor: 0 };
        atual.percentual += Number(item.percentual_medido);
        atual.valor += Number(item.valor_medido);
        pagoPorEtapa.set(item.etapa_id, atual);
      }

      // Contratos escopados a uma etapa especifica - so pra mostrar o link
      // visual etapa -> contrato aqui na Qualidade. Se a coluna etapa_id
      // ainda nao existir (migration nao aplicada), ignora silenciosamente.
      const { data: contratosEtapa } = await supabase
        .from("contratos_fornecedor")
        .select("etapa_id, descricao, valor_contrato")
        .eq("obra_id", obraAtual.id)
        .is("deleted_at", null)
        .not("etapa_id", "is", null);
      for (const contrato of (contratosEtapa ?? []) as { etapa_id: string | null; descricao: string | null; valor_contrato: number }[]) {
        if (!contrato.etapa_id) continue;
        contratoPorEtapa.set(contrato.etapa_id, {
          descricao: contrato.descricao,
          valorContrato: Number(contrato.valor_contrato),
        });
      }
    }
  }

  const nomesFornecedor = new Map(listaFornecedores.map((f) => [f.id, f.nome]));
  const templatesPorId = new Map(templates.map((t) => [t.id, t]));

  if (moduloIndisponivel) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Módulo de qualidade ainda não ativado no Supabase.</p>
        <p className="mt-1">
          Aplique a migration <code>20260730000000_modulo_qualidade.sql</code> pra liberar
          checklists, inspeções e situação de qualidade por etapa.
        </p>
      </div>
    );
  }

  const etapasPanel = !obraAtual ? (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-10 text-center text-sm text-brand-gray-500 shadow-card">
      Cadastre uma obra primeiro.
    </div>
  ) : (
    <div className="flex flex-col gap-6">
      <ObraSelector obras={listaObras} obraAtualId={obraAtual.id} basePath="/dashboard/qualidade" />

      <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="border-b border-brand-gray-300/60 px-5 py-4">
          <p className="text-sm font-semibold text-brand-black">Etapas de {obraAtual.nome}</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Vincule um modelo de checklist e um fornecedor responsável antes de inspecionar.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="oc-table min-w-[860px]">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Fornecedor responsável</th>
                <th>Checklist vinculado</th>
                <th>Situação</th>
                <th>Pago</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((etapa) => {
                const situacao = SITUACAO_LABEL[etapa.situacao_qualidade] ?? SITUACAO_LABEL.nao_inspecionado;
                const template = etapa.checklist_template_id
                  ? templatesPorId.get(etapa.checklist_template_id)
                  : null;
                const pago = pagoPorEtapa.get(etapa.id) ?? { percentual: 0, valor: 0 };
                const pagoPercentual = Math.round(pago.percentual);
                const pagoClasse =
                  pagoPercentual >= 100
                    ? "bg-[#e9f8f0] text-status-success"
                    : pagoPercentual > 0
                      ? "bg-status-warning/15 text-status-warning"
                      : "bg-brand-gray-100 text-brand-gray-700";
                const contrato = contratoPorEtapa.get(etapa.id);

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
                    <td className="text-brand-gray-700">{template?.nome ?? "Nenhum"}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${situacao.classe}`}>
                        {situacao.texto}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${pagoClasse}`}>
                          {pagoPercentual}% pago
                        </span>
                        {pago.valor > 0 && (
                          <span className="text-[11px] text-brand-gray-500">{formatBRL(pago.valor)}</span>
                        )}
                        <Link
                          href={`/dashboard/cronograma?obra=${obraAtual.id}`}
                          className="text-[11px] font-bold text-brand-red hover:underline"
                        >
                          Ver medições →
                        </Link>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <CadastroModal
                          titulo={`Vincular checklist — ${etapa.nome}`}
                          descricao="Escolha o modelo de checklist e o fornecedor responsável por esta etapa."
                          botao="Vincular"
                          icone={<ActionIcon name="layers" />}
                          variante="icone"
                        >
                          <form action={vincularChecklistEtapaAction} className="flex flex-col gap-4">
                            <input type="hidden" name="etapa_id" value={etapa.id} />
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Modelo de checklist
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
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Fornecedor responsável
                              <select
                                name="fornecedor_id"
                                defaultValue={etapa.fornecedor_id ?? ""}
                                className="oc-input"
                              >
                                <option value="">Nenhum</option>
                                {listaFornecedores.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.nome}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <SubmitButton className="oc-button oc-button-primary">
                              Salvar vínculo
                            </SubmitButton>
                          </form>
                        </CadastroModal>

                        {template && template.checklist_itens.length > 0 ? (
                          <CadastroModal
                            titulo={`Inspecionar — ${etapa.nome}`}
                            descricao={`Checklist: ${template.nome}`}
                            botao="Inspecionar"
                            variante="primario"
                            modalSize="wide"
                          >
                            <form action={iniciarInspecaoAction} className="flex flex-col gap-5">
                              <input type="hidden" name="etapa_id" value={etapa.id} />
                              <input type="hidden" name="template_id" value={template.id} />

                              <div className="flex flex-col gap-3">
                                {template.checklist_itens.map((item) => (
                                  <div
                                    key={item.id}
                                    className="rounded-brand-sm border border-brand-gray-300/70 p-4"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="text-sm font-semibold text-brand-black">{item.descricao}</p>
                                      {item.critico && (
                                        <span className="shrink-0 rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-brand-red">
                                          Crítico
                                        </span>
                                      )}
                                    </div>
                                    <select
                                      name={`resposta_${item.id}`}
                                      defaultValue="aprovado"
                                      className="oc-input mt-2"
                                    >
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

                              <SubmitButton className="oc-button oc-button-primary">
                                Concluir inspeção
                              </SubmitButton>
                            </form>
                          </CadastroModal>
                        ) : (
                          <span
                            className="rounded-brand-sm border border-brand-gray-300 bg-brand-gray-100 px-3 py-2 text-xs font-bold text-brand-gray-500"
                            title="Vincule um checklist com itens antes de inspecionar"
                          >
                            Sem checklist
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {etapas.length === 0 && (
                <tr>
                  <td colSpan={6} className="oc-empty">
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

  const modelosPanel = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-black">Modelos de checklist</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Templates reutilizáveis entre etapas e obras.
          </p>
        </div>
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
            <SubmitButton className="oc-button oc-button-primary">
              Salvar modelo
            </SubmitButton>
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
                          <SubmitButton className="oc-button oc-button-primary">
                            Salvar edição
                          </SubmitButton>
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
                            <SubmitButton className="oc-button oc-button-primary self-end">
                              Adicionar
                            </SubmitButton>
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

  return <QualidadeTabs etapasPanel={etapasPanel} modelosPanel={modelosPanel} />;
}
