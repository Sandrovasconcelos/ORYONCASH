"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarDistribuicaoEtapaMesAction } from "../actions";
import { formatBRL } from "@/lib/conversation/format";
import { AppModal } from "../app-modal";

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

type EtapaResumo = { id: string; nome: string; valorOrcado: number };
type Distribuicao = {
  etapaId: string;
  mes: string;
  percentual: number;
  duracaoDias: number;
  observacao: string | null;
};

function formatMes(mes: string): string {
  const [ano, mesNum] = mes.split("-");
  return `${MESES_ABREV[Number(mesNum) - 1]}/${ano.slice(2)}`;
}

function chave(etapaId: string, mes: string): string {
  return `${etapaId}::${mes}`;
}

export function DistribuicaoMensalTable({
  etapas,
  meses,
  distribuicoes,
}: {
  etapas: EtapaResumo[];
  meses: string[];
  distribuicoes: Distribuicao[];
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"percentual" | "valor">("percentual");
  const [celula, setCelula] = useState<{ etapaId: string; mes: string } | null>(null);

  const mapa = new Map<string, Distribuicao>();
  for (const d of distribuicoes) mapa.set(chave(d.etapaId, d.mes), d);

  const totalOrcamento = etapas.reduce((soma, e) => soma + e.valorOrcado, 0);

  if (meses.length === 0) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Sem datas previstas cadastradas.</p>
        <p className="mt-1">
          Defina a data de início e fim previstas de pelo menos uma etapa (na tabela de Etapas
          desta obra) pra habilitar a distribuição mensal.
        </p>
      </div>
    );
  }

  function totalEtapaPercentual(etapaId: string): number {
    return meses.reduce((soma, mes) => soma + (mapa.get(chave(etapaId, mes))?.percentual ?? 0), 0);
  }

  const etapaAtual = celula ? etapas.find((e) => e.id === celula.etapaId) ?? null : null;
  const distribuicaoAtual = celula ? mapa.get(chave(celula.etapaId, celula.mes)) ?? null : null;

  let acumulado = 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-gray-500">
          Clique numa célula pra distribuir % ou R$ da etapa naquele mês.
        </p>
        <div className="inline-flex rounded-brand-sm border border-brand-gray-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setModo("percentual")}
            className={
              modo === "percentual"
                ? "rounded-[6px] bg-brand-black px-3 py-1.5 text-xs font-bold text-white"
                : "px-3 py-1.5 text-xs font-bold text-brand-gray-500"
            }
          >
            % Percentual
          </button>
          <button
            type="button"
            onClick={() => setModo("valor")}
            className={
              modo === "valor"
                ? "rounded-[6px] bg-brand-black px-3 py-1.5 text-xs font-bold text-white"
                : "px-3 py-1.5 text-xs font-bold text-brand-gray-500"
            }
          >
            R$ Valor
          </button>
        </div>
      </div>

      <div className="oc-table-wrap">
        <div className="overflow-x-auto">
          <table className="oc-table w-full text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[200px] bg-brand-gray-100">Etapa da obra</th>
                {meses.map((mes) => (
                  <th key={mes} className="min-w-[92px] text-center">
                    {formatMes(mes)}
                  </th>
                ))}
                <th className="sticky right-0 z-10 min-w-[70px] bg-brand-gray-100 text-center">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((etapa) => {
                const totalPct = totalEtapaPercentual(etapa.id);
                const corTotal =
                  totalPct > 100
                    ? "text-status-danger"
                    : totalPct === 100
                      ? "text-status-success"
                      : "text-status-warning";
                const tituloTotal =
                  totalPct > 100
                    ? "A distribuição da etapa ultrapassa 100%."
                    : totalPct < 100
                      ? `Faltam ${(100 - totalPct).toFixed(0)}% para concluir a distribuição desta etapa.`
                      : "Distribuição completa.";
                return (
                  <tr key={etapa.id}>
                    <td className="sticky left-0 z-10 bg-white font-semibold text-brand-black">
                      {etapa.nome}
                    </td>
                    {meses.map((mes) => {
                      const d = mapa.get(chave(etapa.id, mes));
                      return (
                        <td key={mes} className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => setCelula({ etapaId: etapa.id, mes })}
                            title="Clique para editar percentual, valor ou duração."
                            className="w-full rounded-brand-sm border border-transparent px-2 py-1.5 text-center hover:border-brand-red/40 hover:bg-brand-gray-100"
                          >
                            {d ? (
                              <>
                                <span className="block text-xs font-bold text-brand-black">
                                  {modo === "percentual"
                                    ? `${d.percentual}%`
                                    : formatBRL((etapa.valorOrcado * d.percentual) / 100)}
                                </span>
                                {d.duracaoDias > 0 && (
                                  <span className="block text-[10px] text-brand-gray-500">
                                    {d.duracaoDias} dias
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-brand-gray-300">-</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td
                      className={`sticky right-0 z-10 bg-white text-center text-xs font-extrabold ${corTotal}`}
                      title={tituloTotal}
                    >
                      {totalPct.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 bg-brand-gray-100 text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-gray-500">
                  Total por mês (acum.)
                </td>
                {meses.map((mes) => {
                  const totalMesValor = etapas.reduce((soma, e) => {
                    const d = mapa.get(chave(e.id, mes));
                    return soma + (d ? (e.valorOrcado * d.percentual) / 100 : 0);
                  }, 0);
                  const totalMesPct = totalOrcamento > 0 ? (totalMesValor / totalOrcamento) * 100 : 0;
                  acumulado += totalMesPct;
                  return (
                    <td key={mes} className="text-center text-xs">
                      <span className="block font-bold text-brand-black">
                        {totalMesPct.toFixed(1)}%
                      </span>
                      <span className="block text-[10px] text-brand-gray-500">
                        {acumulado.toFixed(1)}%
                      </span>
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 bg-brand-gray-100" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {celula && etapaAtual && (
        <EditorCelulaModal
          key={`${celula.etapaId}-${celula.mes}`}
          etapa={etapaAtual}
          mes={celula.mes}
          distribuicaoAtual={distribuicaoAtual}
          onClose={() => setCelula(null)}
          onSalvo={() => {
            setCelula(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EditorCelulaModal({
  etapa,
  mes,
  distribuicaoAtual,
  onClose,
  onSalvo,
}: {
  etapa: EtapaResumo;
  mes: string;
  distribuicaoAtual: Distribuicao | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [campo, setCampo] = useState<"percentual" | "valor">("percentual");
  const [percentual, setPercentual] = useState(distribuicaoAtual?.percentual ?? 0);
  const [duracaoDias, setDuracaoDias] = useState(distribuicaoAtual?.duracaoDias ?? 0);
  const [observacao, setObservacao] = useState(distribuicaoAtual?.observacao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const valor = (etapa.valorOrcado * percentual) / 100;

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await salvarDistribuicaoEtapaMesAction({
        etapaId: etapa.id,
        mes,
        percentual,
        duracaoDias,
        observacao: observacao.trim() || null,
      });
      if (!resultado.ok) {
        setErro(resultado.error ?? "Erro ao salvar.");
        return;
      }
      onSalvo();
    });
  }

  return (
    <AppModal
      open
      onClose={onClose}
      eyebrow="Cronograma físico-financeiro"
      title="Detalhamento da etapa no mês"
      description={`${etapa.nome} · ${formatMes(mes)}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="oc-button oc-button-soft">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={pending}
            aria-busy={pending}
            className="oc-button oc-button-primary w-full disabled:cursor-wait disabled:opacity-70 sm:w-auto"
          >
            {pending && (
              <span
                aria-hidden="true"
                className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]"
              />
            )}
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {erro && (
          <div className="rounded-brand-sm border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">
            {erro}
          </div>
        )}

        <div className="inline-flex w-fit rounded-brand-sm border border-brand-gray-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setCampo("percentual")}
            className={
              campo === "percentual"
                ? "rounded-[6px] bg-brand-black px-3 py-1.5 text-xs font-bold text-white"
                : "px-3 py-1.5 text-xs font-bold text-brand-gray-500"
            }
          >
            Percentual (%)
          </button>
          <button
            type="button"
            onClick={() => setCampo("valor")}
            className={
              campo === "valor"
                ? "rounded-[6px] bg-brand-black px-3 py-1.5 text-xs font-bold text-white"
                : "px-3 py-1.5 text-xs font-bold text-brand-gray-500"
            }
          >
            Valor (R$)
          </button>
        </div>

        {campo === "percentual" ? (
          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
            Percentual (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={percentual}
              onChange={(e) => setPercentual(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="oc-input"
            />
            <span className="text-xs font-normal text-brand-gray-500">
              Valor correspondente: {formatBRL(valor)}
            </span>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
            Valor (R$)
            <input
              type="number"
              min={0}
              step="0.01"
              value={valor.toFixed(2)}
              onChange={(e) => {
                const novoValor = Math.max(0, Number(e.target.value));
                const novoPercentual =
                  etapa.valorOrcado > 0 ? (novoValor / etapa.valorOrcado) * 100 : 0;
                setPercentual(Math.min(100, Number(novoPercentual.toFixed(2))));
              }}
              className="oc-input"
            />
            <span className="text-xs font-normal text-brand-gray-500">
              Percentual correspondente: {percentual.toFixed(1)}%
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
          Duração (dias)
          <input
            type="number"
            min={0}
            value={duracaoDias}
            onChange={(e) => setDuracaoDias(Math.max(0, Math.round(Number(e.target.value))))}
            className="oc-input"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
          Observações
          <textarea
            value={observacao}
            maxLength={300}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            className="oc-input resize-none"
          />
          <span className="text-right text-xs font-normal text-brand-gray-500">
            {observacao.length}/300
          </span>
        </label>
      </div>
    </AppModal>
  );
}
