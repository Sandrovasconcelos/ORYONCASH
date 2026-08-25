import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDataHoraBrasil, formatDataBrasil } from "@/lib/format-date";
import { uploadExtratoAction } from "./actions";
import { SubmitButton } from "../submit-button";
import { ExcluirExtratoButton } from "./excluir-extrato-button";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  processando: { texto: "Processando…", classe: "bg-status-warning/15 text-status-warning" },
  concluido: { texto: "Concluído", classe: "bg-status-success/15 text-status-success" },
  erro: { texto: "Erro", classe: "bg-status-danger/15 text-status-danger" },
};

export default async function ConciliacaoPage() {
  const supabase = createAdminClient();

  const [{ data: contas }, extratosQuery] = await Promise.all([
    supabase.from("contas_bancarias").select("id, nome").is("deleted_at", null).order("nome"),
    supabase
      .from("extratos_bancarios")
      .select("id, nome_arquivo, status, erro, periodo_inicio, periodo_fim, total_transacoes, total_conciliadas, created_at, contas_bancarias(nome)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (extratosQuery.error) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Conciliação bancária ainda não ativada no Supabase.</p>
        <p className="mt-1">
          Aplique a migration <code>20260825010000_conciliacao_bancaria.sql</code> pra liberar essa tela.
        </p>
      </div>
    );
  }

  const extratos = extratosQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black text-brand-black">Conciliação bancária</h1>
        <p className="mt-1 text-sm text-brand-gray-600">
          Suba o extrato do banco e o app compara automaticamente com os lançamentos, mostrando o
          que bateu e o que ainda precisa de atenção.
        </p>
      </div>

      <form
        action={uploadExtratoAction}
        className="flex flex-col gap-4 rounded-card border border-black/5 bg-white p-5 shadow-card"
      >
        <p className="text-sm font-bold text-brand-black">Enviar novo extrato</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Conta bancária
            <select
              name="conta_bancaria_id"
              required
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            >
              <option value="">Selecione…</option>
              {(contas ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Período (início) — opcional
            <input
              type="date"
              name="periodo_inicio"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Período (fim) — opcional
            <input
              type="date"
              name="periodo_fim"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
          Arquivo do extrato (PDF, foto ou print)
          <input
            type="file"
            name="arquivo"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            required
            className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-black file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
          />
        </label>
        <SubmitButton
          pendingText="Enviando e lendo o extrato… pode levar até 1 minuto"
          className="self-start rounded-brand-sm bg-brand-red px-5 py-2.5 text-sm font-extrabold text-white shadow-card hover:brightness-110"
        >
          Enviar e conciliar
        </SubmitButton>
      </form>

      <div className="rounded-card border border-black/5 bg-white shadow-card">
        <div className="border-b border-black/5 px-5 py-3">
          <p className="text-sm font-bold text-brand-black">Extratos enviados</p>
        </div>
        {extratos.length === 0 ? (
          <p className="p-5 text-sm text-brand-gray-500">Nenhum extrato enviado ainda.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {extratos.map((extrato) => {
              const statusInfo = STATUS_LABEL[extrato.status] ?? STATUS_LABEL.processando;
              const conta = (extrato as { contas_bancarias?: { nome: string } | null }).contas_bancarias;
              return (
                <li key={extrato.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/dashboard/conciliacao/${extrato.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-brand-black">
                      {conta?.nome ?? "Conta não informada"}
                      {extrato.periodo_inicio && extrato.periodo_fim && (
                        <span className="ml-2 font-medium text-brand-gray-500">
                          {formatDataBrasil(extrato.periodo_inicio)} a {formatDataBrasil(extrato.periodo_fim)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-gray-500">
                      Enviado em {formatDataHoraBrasil(extrato.created_at)} ·{" "}
                      {extrato.status === "concluido"
                        ? `${extrato.total_conciliadas}/${extrato.total_transacoes} conciliadas`
                        : extrato.erro ?? "—"}
                    </p>
                  </Link>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusInfo.classe}`}>
                    {statusInfo.texto}
                  </span>
                  <ExcluirExtratoButton id={extrato.id} nome={conta?.nome ?? "extrato"} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
