import { createAdminClient } from "@/lib/supabase/admin";
import { formatDataHoraBrasil } from "@/lib/format-date";
import { formatBRL } from "@/lib/conversation/format";
import { PermanentDeleteTrashButton, RestoreTrashButton } from "./trash-actions";

export const dynamic = "force-dynamic";

type TipoLixeira =
  | "obra"
  | "categoria"
  | "material"
  | "fornecedor"
  | "despesa"
  | "medicao"
  | "etapa"
  | "contrato_fornecedor"
  | "cronograma_template"
  | "checklist_template"
  | "conta_bancaria";

function formatDataBR(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

type TrashItem = {
  id: string;
  tipo: TipoLixeira;
  nome: string;
  detalhe: string;
  removidoEm: string | null;
  removidoPor: string | null;
  motivo: string | null;
};

export default async function LixeiraPage() {
  const supabase = createAdminClient();

  const [
    { data: obras },
    { data: categorias },
    { data: materiais },
    { data: fornecedores },
    { data: despesas },
    medicoesQuery,
    etapasQuery,
    contratosQuery,
    cronogramaTemplatesQuery,
    checklistTemplatesQuery,
    contasBancariasQuery,
  ] = await Promise.all([
    supabase
      .from("obras")
      .select("id, nome, orcamento_total, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("categorias")
      .select("id, nome, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("materiais")
      .select("id, nome, deleted_at, deleted_by, deleted_reason, categorias(nome)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("fornecedores")
      .select("id, nome, contato, cnpj, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("despesas")
      .select(
        "id, valor, descricao, data, deleted_at, deleted_by, deleted_reason, obras(nome), categorias(nome)"
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("medicoes")
      .select(
        "id, valor_total, status, periodo_inicio, periodo_fim, deleted_at, deleted_by, deleted_reason, obras(nome), categorias(nome)"
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("etapas")
      .select("id, nome, valor_orcado, deleted_at, deleted_by, deleted_reason, obras(nome)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("contratos_fornecedor")
      .select(
        "id, valor_contrato, descricao, deleted_at, deleted_by, deleted_reason, obras(nome), fornecedores(nome)"
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("cronograma_templates")
      .select("id, nome, descricao, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("checklist_templates")
      .select("id, nome, descricao, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("contas_bancarias")
      .select("id, nome, banco, titular, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);
  const medicoes = medicoesQuery.data;
  const etapas = etapasQuery.data;
  const contratos = contratosQuery.data;
  const cronogramaTemplates = cronogramaTemplatesQuery.data;
  const checklistTemplates = checklistTemplatesQuery.data;
  const contasBancarias = contasBancariasQuery.data;

  const itens: TrashItem[] = [
    ...(obras ?? []).map((obra) => ({
      id: obra.id,
      tipo: "obra" as const,
      nome: obra.nome,
      detalhe: `Orçamento ${formatBRL(Number(obra.orcamento_total ?? 0))}`,
      removidoEm: obra.deleted_at,
      removidoPor: obra.deleted_by,
      motivo: obra.deleted_reason,
    })),
    ...(categorias ?? []).map((categoria) => ({
      id: categoria.id,
      tipo: "categoria" as const,
      nome: categoria.nome,
      detalhe: "Categoria usada no WhatsApp, filtros e relatórios",
      removidoEm: categoria.deleted_at,
      removidoPor: categoria.deleted_by,
      motivo: categoria.deleted_reason,
    })),
    ...(materiais ?? []).map((material) => ({
      id: material.id,
      tipo: "material" as const,
      nome: material.nome,
      detalhe:
        (material.categorias as unknown as { nome: string } | null)?.nome ??
        "Sem categoria",
      removidoEm: material.deleted_at,
      removidoPor: material.deleted_by,
      motivo: material.deleted_reason,
    })),
    ...(fornecedores ?? []).map((fornecedor) => ({
      id: fornecedor.id,
      tipo: "fornecedor" as const,
      nome: fornecedor.nome,
      detalhe: fornecedor.cnpj || fornecedor.contato || "Sem contato cadastrado",
      removidoEm: fornecedor.deleted_at,
      removidoPor: fornecedor.deleted_by,
      motivo: fornecedor.deleted_reason,
    })),
    ...(despesas ?? []).map((despesa) => ({
      id: despesa.id,
      tipo: "despesa" as const,
      nome: formatBRL(Number(despesa.valor ?? 0)),
      detalhe: [
        (despesa.obras as unknown as { nome: string } | null)?.nome,
        (despesa.categorias as unknown as { nome: string } | null)?.nome,
        despesa.descricao,
        despesa.data ? new Date(`${despesa.data}T00:00:00`).toLocaleDateString("pt-BR") : null,
      ]
        .filter(Boolean)
        .join(" • "),
      removidoEm: despesa.deleted_at,
      removidoPor: despesa.deleted_by,
      motivo: despesa.deleted_reason,
    })),
    ...(medicoes ?? []).map((medicao) => ({
      id: medicao.id,
      tipo: "medicao" as const,
      nome: formatBRL(Number(medicao.valor_total ?? 0)),
      detalhe: [
        (medicao.obras as unknown as { nome: string } | null)?.nome,
        (medicao.categorias as unknown as { nome: string } | null)?.nome,
        medicao.periodo_inicio && medicao.periodo_fim
          ? `${formatDataBR(medicao.periodo_inicio)} a ${formatDataBR(medicao.periodo_fim)}`
          : null,
        medicao.status,
      ]
        .filter(Boolean)
        .join(" • "),
      removidoEm: medicao.deleted_at,
      removidoPor: medicao.deleted_by,
      motivo: medicao.deleted_reason,
    })),
    ...(etapas ?? []).map((etapa) => ({
      id: etapa.id,
      tipo: "etapa" as const,
      nome: etapa.nome,
      detalhe: [
        (etapa.obras as unknown as { nome: string } | null)?.nome,
        etapa.valor_orcado ? `Orçado ${formatBRL(Number(etapa.valor_orcado))}` : null,
      ]
        .filter(Boolean)
        .join(" • "),
      removidoEm: etapa.deleted_at,
      removidoPor: etapa.deleted_by,
      motivo: etapa.deleted_reason,
    })),
    ...(contratos ?? []).map((contrato) => ({
      id: contrato.id,
      tipo: "contrato_fornecedor" as const,
      nome: formatBRL(Number(contrato.valor_contrato ?? 0)),
      detalhe: [
        (contrato.fornecedores as unknown as { nome: string } | null)?.nome,
        (contrato.obras as unknown as { nome: string } | null)?.nome,
        contrato.descricao,
      ]
        .filter(Boolean)
        .join(" • "),
      removidoEm: contrato.deleted_at,
      removidoPor: contrato.deleted_by,
      motivo: contrato.deleted_reason,
    })),
    ...(cronogramaTemplates ?? []).map((template) => ({
      id: template.id,
      tipo: "cronograma_template" as const,
      nome: template.nome,
      detalhe: template.descricao || "Modelo de cronograma",
      removidoEm: template.deleted_at,
      removidoPor: template.deleted_by,
      motivo: template.deleted_reason,
    })),
    ...(checklistTemplates ?? []).map((template) => ({
      id: template.id,
      tipo: "checklist_template" as const,
      nome: template.nome,
      detalhe: template.descricao || "Modelo de checklist",
      removidoEm: template.deleted_at,
      removidoPor: template.deleted_by,
      motivo: template.deleted_reason,
    })),
    ...(contasBancarias ?? []).map((conta) => ({
      id: conta.id,
      tipo: "conta_bancaria" as const,
      nome: conta.nome,
      detalhe: [conta.banco, conta.titular].filter(Boolean).join(" • ") || "Sem detalhes",
      removidoEm: conta.deleted_at,
      removidoPor: conta.deleted_by,
      motivo: conta.deleted_reason,
    })),
  ].sort((a, b) => {
    const dataA = a.removidoEm ? new Date(a.removidoEm).getTime() : 0;
    const dataB = b.removidoEm ? new Date(b.removidoEm).getTime() : 0;
    return dataB - dataA;
  });

  const totais = itens.reduce<Record<TipoLixeira, number>>(
    (acc, item) => {
      acc[item.tipo] += 1;
      return acc;
    },
    {
      obra: 0,
      categoria: 0,
      material: 0,
      fornecedor: 0,
      despesa: 0,
      medicao: 0,
      etapa: 0,
      contrato_fornecedor: 0,
      cronograma_template: 0,
      checklist_template: 0,
      conta_bancaria: 0,
    }
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-black">Itens removidos</p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-gray-500">
              Tudo que você envia para a lixeira sai das telas principais e das opções do
              WhatsApp, mas continua recuperável aqui. Apagar definitivamente remove do
              banco de dados.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-brand-gray-100 px-3 py-1 text-xs font-bold text-brand-gray-700">
            {itens.length} item(ns)
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <ResumoCard label="Obras" valor={totais.obra} />
        <ResumoCard label="Categorias" valor={totais.categoria} />
        <ResumoCard label="Materiais" valor={totais.material} />
        <ResumoCard label="Fornecedores" valor={totais.fornecedor} />
        <ResumoCard label="Lançamentos" valor={totais.despesa} />
        <ResumoCard label="Medições" valor={totais.medicao} />
        <ResumoCard label="Etapas" valor={totais.etapa} />
        <ResumoCard label="Contratos" valor={totais.contrato_fornecedor} />
        <ResumoCard label="Modelos de cronograma" valor={totais.cronograma_template} />
        <ResumoCard label="Modelos de checklist" valor={totais.checklist_template} />
        <ResumoCard label="Contas bancárias" valor={totais.conta_bancaria} />
      </section>

      <section className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="border-b border-brand-gray-300/60 px-5 py-4">
          <p className="text-sm font-semibold text-brand-black">Tabela da lixeira</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Use restaurar para voltar o item ao app. Use apagar definitivamente apenas quando
            não precisar mais recuperar.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500">
              <tr>
                <th className="px-5 py-3 font-extrabold">Tipo</th>
                <th className="px-5 py-3 font-extrabold">Item</th>
                <th className="px-5 py-3 font-extrabold">Detalhe</th>
                <th className="px-5 py-3 font-extrabold">Removido em</th>
                <th className="px-5 py-3 font-extrabold">Removido por</th>
                <th className="px-5 py-3 font-extrabold">Motivo</th>
                <th className="px-5 py-3 text-right font-extrabold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-gray-300/40">
              {itens.map((item) => (
                <tr key={`${item.tipo}-${item.id}`} className="align-middle hover:bg-brand-gray-100/55">
                  <td className="px-5 py-4">
                    <TipoBadge tipo={item.tipo} />
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-brand-black">{item.nome}</p>
                  </td>
                  <td className="max-w-[320px] px-5 py-4 text-brand-gray-700">
                    <span className="line-clamp-2">{item.detalhe || "—"}</span>
                  </td>
                  <td className="px-5 py-4 text-brand-gray-500">
                    {item.removidoEm ? formatDataHoraBrasil(item.removidoEm) : "—"}
                  </td>
                  <td className="px-5 py-4 text-brand-gray-500">
                    {item.removidoPor || "—"}
                  </td>
                  <td className="max-w-[240px] px-5 py-4 text-brand-gray-500">
                    <span className="line-clamp-2">{item.motivo || "Sem motivo informado"}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <RestoreTrashButton id={item.id} tipo={item.tipo} nome={item.nome} />
                      <PermanentDeleteTrashButton id={item.id} tipo={item.tipo} nome={item.nome} />
                    </div>
                  </td>
                </tr>
              ))}

              {itens.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-brand-gray-500">
                    A lixeira está vazia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ResumoCard({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold text-brand-gray-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-brand-black">{valor}</p>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: TipoLixeira }) {
  const labels: Record<TipoLixeira, string> = {
    obra: "Obra",
    categoria: "Categoria",
    material: "Material",
    fornecedor: "Fornecedor",
    despesa: "Lançamento",
    medicao: "Medição",
    etapa: "Etapa",
    contrato_fornecedor: "Contrato",
    cronograma_template: "Modelo de cronograma",
    checklist_template: "Modelo de checklist",
    conta_bancaria: "Conta bancária",
  };

  return (
    <span className="inline-flex rounded-full bg-brand-red/10 px-3 py-1 text-xs font-bold text-brand-red">
      {labels[tipo]}
    </span>
  );
}
