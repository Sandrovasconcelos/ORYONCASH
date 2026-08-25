import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { formatDataBrasil, formatDataHoraBrasil } from "@/lib/format-date";
import { desvincularTransacaoAction } from "../actions";
import { RevisaoTransacaoModal } from "./revisao-transacao-modal";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  conciliado: { texto: "Conciliado", classe: "bg-status-success/15 text-status-success" },
  pendente: { texto: "Sem lançamento", classe: "bg-status-danger/15 text-status-danger" },
  ignorado: { texto: "Ignorado", classe: "bg-brand-gray-300/40 text-brand-gray-600" },
};

export default async function ConciliacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: despesasCandidatas } = extrato.conta_bancaria_id
    ? await supabase
        .from("despesas")
        .select("id, descricao, valor, data, obras(nome), categorias(nome)")
        .eq("conta_bancaria_id", extrato.conta_bancaria_id)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(200)
    : { data: [] };

  const idsJaVinculados = new Set((transacoes ?? []).map((t) => t.despesa_id).filter(Boolean));
  const candidatasDisponiveis = (despesasCandidatas ?? []).filter((d) => !idsJaVinculados.has(d.id));

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

      {(transacoes ?? []).length > 0 && (
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
              {(transacoes ?? []).map((t) => {
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
                          <p className="font-semibold text-brand-black">{formatBRL(despesa.valor)}</p>
                          <p>
                            {despesa.obras?.nome ?? "—"} · {despesa.categorias?.nome ?? "—"}
                          </p>
                          {despesa.descricao && <p className="text-brand-gray-500">{despesa.descricao}</p>}
                        </>
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
