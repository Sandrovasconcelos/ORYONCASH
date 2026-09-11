"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatBRL } from "@/lib/conversation/format";
import { AppModal } from "../../app-modal";

export type DespesaDoDia = {
  id: string;
  descricao: string | null;
  valor: number;
  obraNome: string | null;
  categoriaNome: string | null;
};

type Celula = { dia: number; dataISO: string } | null;

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Interpola de laranja (baixo) pra vermelho (alto), t em [0,1]. */
function corIntensidade(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Laranja #f59e0b (245,158,11) -> Vermelho #dc2626 (220,38,38)
  const r = Math.round(245 + (220 - 245) * clamped);
  const g = Math.round(158 + (38 - 158) * clamped);
  const b = Math.round(11 + (38 - 11) * clamped);
  return `rgb(${r} ${g} ${b})`;
}

function formatDataBR(dataISO: string): string {
  const [, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}`;
}

export function CalendarioGrid({
  celulas,
  totalPorDia,
  despesasPorDia,
  hoje,
}: {
  celulas: Celula[];
  totalPorDia: Record<string, number>;
  despesasPorDia: Record<string, DespesaDoDia[]>;
  hoje: string;
}) {
  const [metrica, setMetrica] = useState<"valor" | "quantidade">("valor");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const intensidadePorDia = useMemo(() => {
    const valores = new Map<string, number>();
    if (metrica === "valor") {
      for (const [dia, total] of Object.entries(totalPorDia)) valores.set(dia, total);
    } else {
      for (const [dia, lista] of Object.entries(despesasPorDia)) valores.set(dia, lista.length);
    }
    const maior = Math.max(0, ...valores.values());
    return { valores, maior };
  }, [metrica, totalPorDia, despesasPorDia]);

  const despesasDoDiaSelecionado = diaSelecionado ? despesasPorDia[diaSelecionado] ?? [] : [];
  const totalDoDiaSelecionado = diaSelecionado ? totalPorDia[diaSelecionado] ?? 0 : 0;

  return (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-brand-gray-500">
          Clique num dia pra ver os lançamentos. Passe o mouse pra prévia rápida.
        </p>
        <div className="flex items-center gap-1 rounded-full bg-brand-gray-100 p-1 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setMetrica("valor")}
            className={`rounded-full px-3 py-1 transition ${
              metrica === "valor" ? "bg-brand-black text-white" : "text-brand-gray-600 hover:text-brand-black"
            }`}
          >
            Por valor (R$)
          </button>
          <button
            type="button"
            onClick={() => setMetrica("quantidade")}
            className={`rounded-full px-3 py-1 transition ${
              metrica === "quantidade" ? "bg-brand-black text-white" : "text-brand-gray-600 hover:text-brand-black"
            }`}
          >
            Por nº de lançamentos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-brand-gray-500">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {celulas.map((celula, index) => {
          if (!celula) return <div key={`vazio-${index}`} />;

          const totalDia = totalPorDia[celula.dataISO] ?? 0;
          const lancamentosDia = despesasPorDia[celula.dataISO] ?? [];
          const temGasto = totalDia > 0;
          const valorIntensidade = intensidadePorDia.valores.get(celula.dataISO) ?? 0;
          const intensidade = intensidadePorDia.maior > 0 ? valorIntensidade / intensidadePorDia.maior : 0;
          const isHoje = celula.dataISO === hoje;

          const topLancamentos = [...lancamentosDia].sort((a, b) => b.valor - a.valor).slice(0, 3);

          return (
            <div key={celula.dataISO} className="group relative">
              <button
                type="button"
                onClick={() => temGasto && setDiaSelecionado(celula.dataISO)}
                disabled={!temGasto}
                className={`flex aspect-square w-full flex-col justify-between rounded-brand-sm border p-2 text-left transition hover:brightness-95 disabled:cursor-default ${
                  isHoje ? "border-brand-black" : "border-black/5"
                }`}
                style={temGasto ? { backgroundColor: corIntensidade(intensidade) } : undefined}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${temGasto ? "text-white drop-shadow-sm" : "text-brand-gray-600"}`}
                  >
                    {celula.dia}
                  </span>
                  {lancamentosDia.length > 1 && (
                    <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                      {lancamentosDia.length}
                    </span>
                  )}
                </span>
                {temGasto && (
                  <span className="text-right text-[10px] font-extrabold leading-tight text-white drop-shadow-sm">
                    {formatBRL(totalDia)}
                  </span>
                )}
              </button>

              {temGasto && (
                <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-56 -translate-x-1/2 rounded-brand-sm border border-brand-gray-300/60 bg-white p-3 text-left opacity-0 shadow-brand-md transition-opacity duration-150 group-hover:opacity-100">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-brand-gray-500">
                    {formatDataBR(celula.dataISO)} · {formatBRL(totalDia)}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {topLancamentos.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-[11px] text-brand-gray-700">
                        <span className="truncate">{d.obraNome ?? d.categoriaNome ?? d.descricao ?? "Sem descrição"}</span>
                        <span className="shrink-0 font-bold text-brand-black">{formatBRL(d.valor)}</span>
                      </li>
                    ))}
                  </ul>
                  {lancamentosDia.length > topLancamentos.length && (
                    <p className="mt-1 text-[10px] text-brand-gray-500">
                      +{lancamentosDia.length - topLancamentos.length} lançamento(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-[10px] font-bold text-brand-gray-500">
        <span>Menos</span>
        <span className="flex h-3 w-24 overflow-hidden rounded-full">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="flex-1" style={{ backgroundColor: corIntensidade(i / 11) }} />
          ))}
        </span>
        <span>Mais</span>
      </div>

      <AppModal
        open={diaSelecionado !== null}
        onClose={() => setDiaSelecionado(null)}
        eyebrow="Gastos do dia"
        title={diaSelecionado ? `${formatDataBR(diaSelecionado)} — ${formatBRL(totalDoDiaSelecionado)}` : ""}
        description={`${despesasDoDiaSelecionado.length} lançamento(s)`}
        footer={
          diaSelecionado && (
            <Link
              href={`/dashboard/despesas?data=${diaSelecionado}`}
              className="oc-button oc-button-primary w-full text-center sm:w-auto"
            >
              Ver e editar na tela de Lançamentos
            </Link>
          )
        }
      >
        <ul className="flex flex-col divide-y divide-black/5">
          {despesasDoDiaSelecionado
            .slice()
            .sort((a, b) => b.valor - a.valor)
            .map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-black">
                    {d.obraNome ?? "Sem obra"} · {d.categoriaNome ?? "Sem categoria"}
                  </p>
                  {d.descricao && <p className="truncate text-xs text-brand-gray-500">{d.descricao}</p>}
                </div>
                <span className="shrink-0 font-extrabold text-brand-black">{formatBRL(d.valor)}</span>
              </li>
            ))}
        </ul>
      </AppModal>
    </div>
  );
}
