import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { formatDataBrasil, formatDataHoraBrasil } from "@/lib/format-date";
import { aceitarTodasSugestoesAction, aceitarVinculoAction, desvincularTransacaoAction, reconciliarExtratoAction } from "../actions";
import { buscarVinculosPorValor } from "@/lib/conciliacao/vinculosPorValor";
import { carregarNotas, expandirParaNota } from "@/lib/despesas/notas";
import { SubmitButton } from "../../submit-button";
import { RevisaoTransacaoModal } from "./revisao-transacao-modal";
import { sugerirLancamentos } from "@/lib/conciliacao/sugestoes";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  conciliado: { texto: "Conciliado", classe: "bg-status-success/15 text-status-success" },
  pendente: { texto: "Sem lançamento", classe: "bg-status-danger/15 text-status-danger" },
  ignorado: { texto: "Ignorado", classe: "bg-brand-gray-300/40 text-brand-gray-600" },
};

export default async function ConciliacaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { id } = await params;
  const { filtro } = await searchParams;
  const supabase = createAdminClient();

  const { data: extrato } = await supabase
    .from("extratos_bancarios")
    .select("*, contas_bancarias(id, nome)")
    .eq("id", id)
    .maybeSingle();

  if (!extrato) notFound();

  const [{ data: transacoes }, { data: obras }, { data: categorias }] = await Promise.all([
    supabase
      .from("extrato_transacoes")
      .select("id, data, descricao, valor, tipo, status, despesa_id, despesas(id, descricao, valor, data, obras(nome), categorias(nome))")
      .eq("extrato_id", id)
      .order("data"),
    supabase.from("obras").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("categorias").select("id, nome").is("deleted_at", null).order("nome"),
  ]);

  const conta = (extrato as { contas_bancarias?: { id: string; nome: string } | null }).contas_bancarias;

  // Inclui despesas SEM conta bancária definida como candidatas tambem -
  // a maioria dos lancamentos (WhatsApp, e muitos do dashboard) nunca
  // preenche esse campo, entao restringir so a mesma conta do extrato
  // deixava a lista vazia quase sempre ("nenhum lancamento pra vincular")
  // mesmo com o lancamento certo existindo no sistema.
  const { data: despesasCandidatas } = extrato.conta_bancaria_id
    ? await supabase
        .from("despesas")
        .select("id, descricao, valor, data, conta_bancaria_id, obras(nome), categorias(nome)")
        .or(`conta_bancaria_id.eq.${extrato.conta_bancaria_id},conta_bancaria_id.is.null`)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(200)
    : await supabase
        .from("despesas")
        .select("id, descricao, valor, data, conta_bancaria_id, obras(nome), categorias(nome)")
        .is("conta_bancaria_id", null)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(200);

  const pendentes = (transacoes ?? []).filter((t) => t.status === "pendente" && t.tipo === "debito");
  const totalPendente = pendentes.reduce((soma, t) => soma + t.valor, 0);
  const sugestoes = await sugerirLancamentos(pendentes).catch(() => new Map());
  const vinculosPorValor = await buscarVinculosPorValor(pendentes).catch(() => new Map());
  const transacoesVisiveis = filtro === "pendente" ? pendentes : (transacoes ?? []);

  const idsLigados = (transacoes ?? []).map((t) => t.despesa_id).filter((id): id is string => Boolean(id));
  // Nota com varios itens = um pagamento so no banco: o vinculo vale pra nota toda.
  const idsJaVinculados = await expandirParaNota(idsLigados);
  const notasPorDespesa = await carregarNotas([...idsLigados, ...(despesasCandidatas ?? []).map((d) => d.id)]);
  const jaMostrada = new Set<string>();
  const candidatasDisponiveis = (despesasCandidatas ?? [])
    .filter((d) => !idsJaVinculados.has(d.id))
    .flatMap((d) => {
      const nota = notasPorDespesa.get(d.id);
      if (!nota) return [d];
      if (jaMostrada.has(nota.chave)) return [];
      jaMostrada.add(nota.chave);
      return [{ ...d, valor: nota.total, descricao: `Nota com ${nota.membros.length} itens${d.descricao ? ` (ex.: ${d.descricao})` : ""}` }];
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/conciliacao" className="text-xs font-bold text-brand-gray-500 hover:text-brand-black">
            ← Voltar
          </Link>
          <h1 className="mt-1 text-xl font-black text-brand-black">
            {conta?.nome ?? "Extrato"}
            {extrato.periodo_inicio && extrato.periodo_fim && (
              <span className="ml-2 text-sm font-semibold text-brand-gray-500">
                {formatDataBrasil(extrato.periodo_inicio)} a {formatDataBrasil(extrato.periodo_fim)}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-brand-gray-500">
            Enviado em {formatDataHoraBrasil(extrato.created_at)}
            {extrato.created_by ? ` por ${extrato.created_by}` : ""}
          </p>
        </div>
        {extrato.status === "concluido" && (
          <div className="shrink-0 rounded-card border border-black/5 bg-white px-4 py-3 text-center shadow-card">
            <p className="text-lg font-black text-brand-black">
              {extrato.total_conciliadas}/{extrato.total_transacoes}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-gray-500">conciliadas</p>
          </div>
        )}
      </div>

      {extrato.status === "erro" && (
        <div className="rounded-card border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-brand-gray-700 shadow-card">
          <p className="font-semibold text-brand-black">Falha ao processar este extrato</p>
          <p className="mt-1">{extrato.erro}</p>
        </div>
      )}

      {extrato.status === "processando" && (
        <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
          Ainda processando — se ficar muito tempo assim, o processamento pode ter caído (extrato
          muito grande). Exclua e tente enviar de novo em partes menores.
        </div>
      )}

      {pendentes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-brand-gray-700 shadow-card">
          <p>
            <strong className="text-brand-black">{pendentes.length} pagamento(s) sem lançamento</strong> no app, somando{" "}
            <strong className="text-brand-black">{formatBRL(totalPendente)}</strong>.
          </p>
          <div className="flex items-center gap-4">
            <form action={reconciliarExtratoAction}>
              <input type="hidden" name="extrato_id" value={extrato.id} />
              <SubmitButton className="text-xs font-bold text-brand-black hover:underline" pendingText="Conferindo…">
                Conciliar novamente
              </SubmitButton>
            </form>
          <Link
            href={filtro === "pendente" ? `/dashboard/conciliacao/${extrato.id}` : `/dashboard/conciliacao/${extrato.id}?filtro=pendente`}
            className="text-xs font-bold text-brand-red hover:underline"
          >
            {filtro === "pendente" ? "Ver todas as transações" : "Ver só os sem lançamento"}
          </Link>
          </div>
        </div>
      )}

      {vinculosPorValor.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-brand-gray-700 shadow-card">
          <p>
            <strong className="text-brand-black">{vinculosPorValor.size} pagamento(s) têm lançamento de mesmo valor com data diferente</strong>
            {" "}(lançados dias depois). Aceite pra vincular e acertar a data do lançamento pela data do pagamento no banco.
          </p>
          <form action={aceitarTodasSugestoesAction}>
            <input type="hidden" name="extrato_id" value={extrato.id} />
            <SubmitButton className="rounded-brand-sm bg-brand-black px-3 py-2 text-xs font-bold text-white" pendingText="Vinculando…">
              Aceitar todas e acertar as datas
            </SubmitButton>
          </form>
        </div>
      )}

      {transacoesVisiveis.length > 0 && (
        <div className="overflow-hidden rounded-card border border-black/5 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-brand-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-brand-gray-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lançamento vinculado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {transacoesVisiveis.map((t) => {
                const statusInfo = STATUS_LABEL[t.status] ?? STATUS_LABEL.pendente;
                const despesa = (
                  t as {
                    despesas?: {
                      id: string;
                      descricao: string | null;
                      valor: number;
                      data: string;
                      obras?: { nome: string } | null;
                      categorias?: { nome: string } | null;
                    } | null;
                  }
                ).despesas;

                return (
                  <tr key={t.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-brand-gray-600">{formatDataBrasil(t.data)}</td>
                    <td className="px-4 py-3 text-brand-black">{t.descricao ?? "—"}</td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-bold ${
                        t.tipo === "credito" ? "text-status-success" : "text-brand-black"
                      }`}
                    >
                      {t.tipo === "credito" ? "+" : "-"} {formatBRL(t.valor)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusInfo.classe}`}>
                        {statusInfo.texto}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-gray-600">
                      {despesa ? (
                        <>
                          <p className="font-semibold text-brand-black">
                            {formatBRL(notasPorDespesa.get(despesa.id)?.total ?? despesa.valor)}
                          </p>
                          {notasPorDespesa.get(despesa.id) && (
                            <p className="font-semibold text-brand-red">
                              🧾 Nota com {notasPorDespesa.get(despesa.id)!.membros.length} itens
                            </p>
                          )}
                          <p>
                            {despesa.obras?.nome ?? "—"} · {despesa.categorias?.nome ?? "—"}
                          </p>
                          {despesa.descricao && <p className="text-brand-gray-500">{despesa.descricao}</p>}
                        </>
                      ) : vinculosPorValor.get(t.id) ? (
                        <div className="flex flex-col gap-1">
                          <p className="font-semibold text-status-warning">Possível lançamento (data diferente)</p>
                          <p>
                            {vinculosPorValor.get(t.id)!.despesaData.split("-").reverse().join("/")} · {formatBRL(vinculosPorValor.get(t.id)!.despesaValor)}{vinculosPorValor.get(t.id)!.itens > 1 ? ` · nota com ${vinculosPorValor.get(t.id)!.itens} itens` : ""}
                            {vinculosPorValor.get(t.id)!.despesaDescricao ? ` · ${vinculosPorValor.get(t.id)!.despesaDescricao}` : ""}
                          </p>
                          <div className="flex gap-3">
                            {["sim", "nao"].map((ajustar) => (
                              <form key={ajustar} action={aceitarVinculoAction}>
                                <input type="hidden" name="transacao_id" value={t.id} />
                                <input type="hidden" name="despesa_id" value={vinculosPorValor.get(t.id)!.despesaId} />
                                <input type="hidden" name="extrato_id" value={extrato.id} />
                                <input type="hidden" name="ajustar_data" value={ajustar} />
                                <button type="submit" className="font-bold text-brand-red hover:underline">
                                  {ajustar === "sim" ? "Vincular e acertar a data" : "Só vincular"}
                                </button>
                              </form>
                            ))}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {t.status === "conciliado" ? (
                        <form action={desvincularTransacaoAction}>
                          <input type="hidden" name="transacao_id" value={t.id} />
                          <input type="hidden" name="extrato_id" value={extrato.id} />
                          <button type="submit" className="text-xs font-bold text-brand-gray-500 hover:text-brand-red">
                            Desvincular
                          </button>
                        </form>
                      ) : t.tipo === "debito" ? (
                        <RevisaoTransacaoModal
                          transacaoId={t.id}
                          extratoId={extrato.id}
                          contaBancariaId={extrato.conta_bancaria_id}
                          transacaoValor={t.valor}
                          transacaoData={t.data}
                          transacaoDescricao={t.descricao}
                          despesasCandidatas={candidatasDisponiveis}
                          obras={obras ?? []}
                          categorias={categorias ?? []}
                          sugestao={sugestoes.get(t.id) ?? null}
                        />
                      ) : (
                        <span className="text-xs text-brand-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
