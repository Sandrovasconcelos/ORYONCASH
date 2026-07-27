import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import {
  createEtapaAction,
  createObraAction,
  deleteEtapaAction,
  moveObraToTrashAction,
  permanentlyDeleteObraAction,
  restoreObraFromTrashAction,
  updateEtapaAction,
  updateObraAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";
import { ImportarOrcamentoForm } from "./importar-orcamento-form";
import {
  MoveObraToTrashButton,
  PermanentlyDeleteObraButton,
  RestoreObraButton,
} from "./obra-trash-buttons";

export const dynamic = "force-dynamic";

function valorInputBR(valor: number) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type ObraComLixeira = {
  id: string;
  nome: string;
  orcamento_total: number;
  status: "ativa" | "concluida";
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
};

async function buscarObrasComFallback(supabase: ReturnType<typeof createAdminClient>) {
  const comLixeira = await supabase
    .from("obras")
    .select(
      "id, nome, orcamento_total, status, created_at, deleted_at, deleted_by, deleted_reason"
    )
    .order("created_at", { ascending: false });

  if (!comLixeira.error) {
    return {
      data: (comLixeira.data ?? []) as ObraComLixeira[],
      lixeiraIndisponivel: false,
    };
  }

  const semLixeira = await supabase
    .from("obras")
    .select("id, nome, orcamento_total, status, created_at")
    .order("created_at", { ascending: false });

  return {
    data: ((semLixeira.data ?? []) as Array<Omit<ObraComLixeira, "deleted_at" | "deleted_by" | "deleted_reason">>).map(
      (obra) => ({
        ...obra,
        deleted_at: null,
        deleted_by: null,
        deleted_reason: null,
      })
    ),
    lixeiraIndisponivel: true,
  };
}

export default async function ObrasPage() {
  const supabase = createAdminClient();
  const [obrasQuery, { data: despesas }, { data: etapas }] = await Promise.all([
    buscarObrasComFallback(supabase),
    supabase.from("despesas").select("obra_id, etapa_id, valor"),
    supabase.from("etapas").select("id, obra_id, nome, ordem, valor_orcado, created_at").order("ordem"),
  ]);

  const todasAsObras = obrasQuery.data;
  const lixeiraIndisponivel = obrasQuery.lixeiraIndisponivel;
  const lista = todasAsObras.filter((obra) => !obra.deleted_at);
  const lixeira = todasAsObras
    .filter((obra) => Boolean(obra.deleted_at))
    .sort((a, b) => {
      const dataA = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
      const dataB = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
      return dataB - dataA;
    });
  const gastoPorObra = new Map<string, number>();
  const etapasPorObra = new Map<string, number>();
  const usoPorEtapa = new Map<string, number>();

  for (const d of despesas ?? []) {
    gastoPorObra.set(d.obra_id, (gastoPorObra.get(d.obra_id) ?? 0) + Number(d.valor ?? 0));
  }
  for (const etapa of etapas ?? []) {
    if (!etapa.obra_id) continue;
    etapasPorObra.set(etapa.obra_id, (etapasPorObra.get(etapa.obra_id) ?? 0) + 1);
  }
  for (const d of despesas ?? []) {
    if (!d.etapa_id) continue;
    usoPorEtapa.set(d.etapa_id, (usoPorEtapa.get(d.etapa_id) ?? 0) + 1);
  }

  const totalOrcado = lista.reduce((sum, obra) => sum + Number(obra.orcamento_total ?? 0), 0);
  const totalGasto = Array.from(gastoPorObra.values()).reduce((sum, valor) => sum + valor, 0);

  return (
    <div className="flex flex-col gap-6">
      {lixeiraIndisponivel && (
        <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700">
          <p className="font-semibold text-brand-black">Lixeira ainda não aplicada no Supabase.</p>
          <p className="mt-1">
            Estou exibindo suas obras pelo modo compatível. Para ativar apagar/restaurar,
            aplique a migration <code>20260727030000_lixeira_soft_delete.sql</code>.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-black">Obras</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Cadastre, acompanhe e edite as obras que recebem lançamentos do WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CadastroModal
            titulo="Nova obra"
            descricao="Cadastre a obra para liberar lançamentos e relatórios por projeto."
            botao="+ Cadastrar obra"
            variante="primario"
          >
            <form action={createObraAction} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                Nome da obra
                <input
                  name="nome"
                  required
                  placeholder="Ex: Costa Amalfitana"
                  className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                Orçamento total
                <input
                  name="orcamento"
                  placeholder="Ex: 500000,00"
                  required
                  className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                />
              </label>
              <button
                type="submit"
                className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700"
              >
                Salvar obra
              </button>
            </form>
          </CadastroModal>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ResumoCard label="Obras" valor={String(lista.length)} />
        <ResumoCard label="Orçamento total" valor={formatBRL(totalOrcado)} />
        <ResumoCard label="Gasto lançado" valor={formatBRL(totalGasto)} destaque />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_390px]">
        <section className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
          <div className="border-b border-brand-gray-300/60 px-5 py-4">
            <p className="text-sm font-semibold text-brand-black">Tabela de obras</p>
            <p className="mt-1 text-xs text-brand-gray-500">
              A obra é o primeiro cadastro do fluxo. Depois dela vêm orçamento, etapas e lançamentos.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500">
                <tr>
                  <th className="px-5 py-3 font-extrabold">Obra</th>
                  <th className="px-5 py-3 font-extrabold">Orçamento</th>
                  <th className="px-5 py-3 font-extrabold">Gasto</th>
                  <th className="px-5 py-3 font-extrabold">Etapas</th>
                  <th className="px-5 py-3 font-extrabold">Status</th>
                  <th className="px-5 py-3 text-right font-extrabold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-gray-300/40">
                {lista.map((obra) => {
                  const gasto = gastoPorObra.get(obra.id) ?? 0;
                  const percentual =
                    Number(obra.orcamento_total) > 0
                      ? Math.min(100, (gasto / Number(obra.orcamento_total)) * 100)
                      : 0;

                  return (
                    <tr key={obra.id} className="align-middle hover:bg-brand-gray-100/55">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-brand-black">{obra.nome}</p>
                        <p className="mt-1 text-xs text-brand-gray-500">
                          Criada em {new Date(obra.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-brand-gray-700">
                        {formatBRL(obra.orcamento_total)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-brand-black">{formatBRL(gasto)}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-gray-300">
                          <span
                            className="block h-full rounded-full bg-brand-red"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex min-w-10 justify-center rounded-full bg-brand-gray-100 px-3 py-1 text-xs font-bold text-brand-gray-700">
                          {etapasPorObra.get(obra.id) ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-brand-gray-100 px-3 py-1 text-xs font-semibold capitalize text-brand-gray-700">
                          {obra.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <CadastroModal
                            titulo="Editar obra"
                            descricao="Atualize nome, orçamento e status da obra."
                            botao="Editar"
                            icone={<ActionIcon name="edit" />}
                            variante="icone"
                          >
                            <form action={updateObraAction} className="flex flex-col gap-4">
                              <input type="hidden" name="id" value={obra.id} />
                              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                Nome da obra
                                <input
                                  name="nome"
                                  defaultValue={obra.nome}
                                  required
                                  className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                Orçamento total
                                <input
                                  name="orcamento"
                                  defaultValue={valorInputBR(obra.orcamento_total)}
                                  required
                                  className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                Status
                                <select
                                  name="status"
                                  defaultValue={obra.status}
                                  className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                                >
                                  <option value="ativa">Ativa</option>
                                  <option value="concluida">Concluída</option>
                                </select>
                              </label>
                              <button
                                type="submit"
                                className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700"
                              >
                                Salvar edição
                              </button>
                            </form>
                          </CadastroModal>
                          <CadastroModal
                            titulo={`Etapas de ${obra.nome}`}
                            descricao="Essas são as etapas que aparecem no WhatsApp quando essa obra é selecionada."
                            botao="Etapas"
                            icone={<ActionIcon name="layers" />}
                            variante="icone"
                          >
                            <div className="flex flex-col gap-5">
                              <form action={createEtapaAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px_150px_auto]">
                                <input type="hidden" name="obra_id" value={obra.id} />
                                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                  Nova etapa
                                  <input
                                    name="nome"
                                    required
                                    placeholder="Ex: Instalações elétricas"
                                    className="oc-input"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                  Ordem
                                  <input name="ordem" type="number" min="1" defaultValue={(etapasPorObra.get(obra.id) ?? 0) + 1} className="oc-input" />
                                </label>
                                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                  Valor orçado
                                  <input name="valor_orcado" placeholder="0,00" className="oc-input" />
                                </label>
                                <button type="submit" className="oc-button oc-button-primary self-end">
                                  Adicionar
                                </button>
                              </form>

                              <div className="overflow-x-auto rounded-card border border-brand-gray-300/70">
                                <table className="oc-table min-w-[620px]">
                                  <thead>
                                    <tr>
                                      <th>Ordem</th>
                                      <th>Etapa</th>
                                      <th>Orçado</th>
                                      <th>Uso</th>
                                      <th className="text-right">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(etapas ?? [])
                                      .filter((etapa) => etapa.obra_id === obra.id)
                                      .map((etapa) => (
                                        <tr key={etapa.id}>
                                          <td className="text-brand-gray-500">{etapa.ordem}</td>
                                          <td>
                                            <p className="font-semibold text-brand-black">{etapa.nome}</p>
                                          </td>
                                          <td>{formatBRL(Number(etapa.valor_orcado ?? 0))}</td>
                                          <td>
                                            <span className="oc-badge">{usoPorEtapa.get(etapa.id) ?? 0}</span>
                                          </td>
                                          <td>
                                            <div className="flex items-center justify-end gap-2">
                                              <CadastroModal
                                                titulo="Editar etapa"
                                                descricao="Ao editar, o WhatsApp passa a mostrar esse novo nome para a obra."
                                                botao="Editar"
                                              >
                                                <form action={updateEtapaAction} className="flex flex-col gap-4">
                                                  <input type="hidden" name="id" value={etapa.id} />
                                                  <input type="hidden" name="obra_id" value={obra.id} />
                                                  <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                                    Nome
                                                    <input name="nome" defaultValue={etapa.nome} required className="oc-input" />
                                                  </label>
                                                  <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                                    Ordem
                                                    <input name="ordem" type="number" min="1" defaultValue={etapa.ordem} className="oc-input" />
                                                  </label>
                                                  <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                                    Valor orçado
                                                    <input name="valor_orcado" defaultValue={valorInputBR(Number(etapa.valor_orcado ?? 0))} className="oc-input" />
                                                  </label>
                                                  <button type="submit" className="oc-button oc-button-primary">
                                                    Salvar etapa
                                                  </button>
                                                </form>
                                              </CadastroModal>
                                              <DeleteCadastroButton
                                                id={etapa.id}
                                                nome={etapa.nome}
                                                entidade="Etapa"
                                                usadoEm={usoPorEtapa.get(etapa.id) ?? 0}
                                                detalhesUso={`${usoPorEtapa.get(etapa.id) ?? 0} lançamento(s) vinculados.`}
                                                action={deleteEtapaAction}
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    {(etapas ?? []).filter((etapa) => etapa.obra_id === obra.id).length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="oc-empty">
                                          Nenhuma etapa própria cadastrada. O WhatsApp usará as etapas padrão até você adicionar etapas aqui ou importar um orçamento.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </CadastroModal>
                          <Link
                            href={`/dashboard/despesas?obra=${obra.id}`}
                            aria-label="Ver lançamentos"
                            title="Ver lançamentos"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-gray-300 bg-white text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
                          >
                            <ActionIcon name="receipt" />
                          </Link>
                          {lixeiraIndisponivel ? (
                            <span className="rounded-brand-sm border border-brand-gray-300 bg-brand-gray-100 px-4 py-2 text-xs font-extrabold text-brand-gray-500">
                              Lixeira pendente
                            </span>
                          ) : (
                            <MoveObraToTrashButton id={obra.id} action={moveObraToTrashAction} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-brand-gray-500">
                      Nenhuma obra cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <ImportarOrcamentoForm obras={lista} />
          <div className="rounded-card border border-brand-gray-300/60 bg-[#111317] p-5 text-white shadow-card">
            <p className="text-sm font-semibold">Próximo passo</p>
            <p className="mt-2 text-xs leading-5 text-[#aab0b9]">
              Depois de criar a obra, importe o orçamento para gerar etapas. Isso deixa os lançamentos do WhatsApp mais organizados.
            </p>
          </div>
        </aside>
      </div>

      <section className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="border-b border-brand-gray-300/60 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-black">Lixeira de obras</p>
              <p className="mt-1 text-xs text-brand-gray-500">
                Obras apagadas ficam aqui para restauração ou exclusão definitiva.
              </p>
            </div>
            <span className="oc-badge">{lixeira.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="oc-table min-w-[860px]">
            <thead>
              <tr>
                <th>Obra</th>
                <th>Orçamento</th>
                <th>Apagada em</th>
                <th>Motivo</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lixeira.map((obra) => (
                <tr key={obra.id}>
                  <td>
                    <p className="font-semibold text-brand-black">{obra.nome}</p>
                    <p className="mt-1 text-xs text-brand-gray-500">
                      Por {obra.deleted_by ?? "usuário do dashboard"}
                    </p>
                  </td>
                  <td>{formatBRL(Number(obra.orcamento_total ?? 0))}</td>
                  <td className="text-brand-gray-500">
                    {obra.deleted_at
                      ? new Date(obra.deleted_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>
                  <td className="max-w-[260px] truncate text-brand-gray-500">
                    {obra.deleted_reason ?? "Sem motivo informado"}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <RestoreObraButton id={obra.id} action={restoreObraFromTrashAction} />
                      <PermanentlyDeleteObraButton
                        id={obra.id}
                        action={permanentlyDeleteObraAction}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {lixeira.length === 0 && (
                <tr>
                  <td colSpan={5} className="oc-empty">
                    Nenhuma obra na lixeira.
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

function ResumoCard({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold text-brand-gray-500">{label}</p>
      <p
        className={
          destaque
            ? "mt-1 font-display text-xl font-bold text-brand-red"
            : "mt-1 font-display text-xl font-bold text-brand-black"
        }
      >
        {valor}
      </p>
    </div>
  );
}
