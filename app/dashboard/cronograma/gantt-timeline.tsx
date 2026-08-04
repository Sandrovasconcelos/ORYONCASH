"use client";

import { AtividadeStatusSelect } from "./atividade-status-select";

type Atividade = {
  id: string;
  descricao: string;
  ordem: number;
  status: string;
};

type Fase = {
  id: string;
  nome: string;
  dataInicioPrevista: string;
  dataFimPrevista: string;
  atividades: Atividade[];
};

const PESO_STATUS: Record<string, number> = {
  concluida: 1,
  em_andamento: 0.5,
  a_fazer: 0,
};

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const STATUS_PRAZO: Record<
  string,
  { texto: string; classe: string; barra: string }
> = {
  concluida: {
    texto: "Concluída",
    classe: "bg-[#e9f8f0] text-status-success",
    barra: "bg-[color:var(--status-success)]",
  },
  no_prazo: {
    texto: "No prazo",
    classe: "bg-[#e9f8f0] text-status-success",
    barra: "bg-[color:var(--status-success)]",
  },
  atrasada: {
    texto: "Atrasada",
    classe: "bg-status-danger/15 text-status-danger",
    barra: "bg-status-danger",
  },
  nao_iniciada: {
    texto: "Não iniciada",
    classe: "bg-brand-gray-100 text-brand-gray-700",
    barra: "bg-brand-gray-300",
  },
};

function parseISO(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function percentualFase(atividades: Atividade[]): number {
  if (atividades.length === 0) return 0;
  const soma = atividades.reduce((acc, a) => acc + (PESO_STATUS[a.status] ?? 0), 0);
  return Math.round((soma / atividades.length) * 100);
}

/**
 * Mesma logica de "schedule variance" usada no mercado (Sienge, MS Project):
 * compara % do prazo ja decorrido com % realmente executado. Se o tempo
 * andou mais rapido que o progresso, a fase esta atrasada - sem precisar
 * calcular caminho critico.
 */
function statusPrazoFase(
  percentualReal: number,
  inicio: Date,
  fim: Date,
  hoje: Date
): keyof typeof STATUS_PRAZO {
  if (percentualReal >= 100) return "concluida";
  if (hoje < inicio) return "nao_iniciada";
  if (hoje > fim) return "atrasada";

  const duracaoTotal = diasEntre(inicio, fim) || 1;
  const percentualEsperado = (diasEntre(inicio, hoje) / duracaoTotal) * 100;
  return percentualReal + 5 >= percentualEsperado ? "no_prazo" : "atrasada";
}

export function GanttTimeline({ fases, hojeISO }: { fases: Fase[]; hojeISO: string }) {
  if (fases.length === 0) return null;

  const hoje = parseISO(hojeISO);
  const inicio = parseISO(
    fases.reduce((min, f) => (f.dataInicioPrevista < min ? f.dataInicioPrevista : min), fases[0].dataInicioPrevista)
  );
  const fim = parseISO(
    fases.reduce((max, f) => (f.dataFimPrevista > max ? f.dataFimPrevista : max), fases[0].dataFimPrevista)
  );
  const totalDias = Math.max(1, diasEntre(inicio, fim) + 1);
  const hojeDentroDoRange = hoje >= inicio && hoje <= fim;
  const hojeLeftPct = (diasEntre(inicio, hoje) / totalDias) * 100;

  const fasesComStatus = fases.map((fase) => {
    const dataInicioFase = parseISO(fase.dataInicioPrevista);
    const dataFimFase = parseISO(fase.dataFimPrevista);
    const percentual = percentualFase(fase.atividades);
    const status = statusPrazoFase(percentual, dataInicioFase, dataFimFase, hoje);
    return { fase, dataInicioFase, dataFimFase, percentual, status };
  });
  const fasesAtrasadas = fasesComStatus.filter((f) => f.status === "atrasada").length;

  const marcasDeMes: { label: string; leftPct: number }[] = [];
  const cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
  while (cursor <= fim) {
    const referencia = cursor < inicio ? inicio : cursor;
    const leftPct = (diasEntre(inicio, referencia) / totalDias) * 100;
    marcasDeMes.push({
      label: `${MESES_ABREV[cursor.getUTCMonth()]}/${String(cursor.getUTCFullYear()).slice(2)}`,
      leftPct,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {fasesAtrasadas > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-danger/15 px-3 py-1 font-bold text-status-danger">
            ● Obra atrasada — {fasesAtrasadas} de {fases.length} fase(s) fora do prazo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f8f0] px-3 py-1 font-bold text-status-success">
            ● No prazo
          </span>
        )}
        <span className="text-brand-gray-500">
          Previsão de conclusão: {String(fim.getUTCDate()).padStart(2, "0")}/
          {String(fim.getUTCMonth() + 1).padStart(2, "0")}/{fim.getUTCFullYear()}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="relative min-w-[640px]">
          <div className="relative mb-2 h-5 border-b border-brand-gray-300/60 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gray-500">
            {marcasDeMes.map((marca) => (
              <span
                key={marca.label + marca.leftPct}
                className="absolute -translate-x-0"
                style={{ left: `${marca.leftPct}%` }}
              >
                {marca.label}
              </span>
            ))}
          </div>

          {hojeDentroDoRange && (
            <div
              className="pointer-events-none absolute bottom-0 top-5 z-10 w-px bg-brand-red"
              style={{ left: `${hojeLeftPct}%` }}
            >
              <span className="absolute -top-4 -translate-x-1/2 rounded-sm bg-brand-red px-1 text-[9px] font-extrabold text-white">
                Hoje
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {fasesComStatus.map(({ fase, dataInicioFase, dataFimFase, percentual, status }) => {
              const leftPct = (diasEntre(inicio, dataInicioFase) / totalDias) * 100;
              const widthPct = Math.max(
                2,
                ((diasEntre(dataInicioFase, dataFimFase) + 1) / totalDias) * 100
              );
              const estilo = STATUS_PRAZO[status];

              return (
                <details key={fase.id} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 py-1">
                    <span className="w-40 shrink-0 truncate text-xs font-bold text-brand-black">
                      {fase.nome}
                    </span>
                    <span className="relative h-6 flex-1 rounded-full bg-brand-gray-100">
                      <span
                        className="absolute inset-y-0 rounded-full bg-brand-gray-300/70"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      >
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full ${estilo.barra}`}
                          style={{ width: `${percentual}%` }}
                        />
                      </span>
                    </span>
                    <span
                      className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-bold ${estilo.classe}`}
                    >
                      {estilo.texto}
                    </span>
                    <span className="w-10 shrink-0 text-right text-xs font-extrabold text-brand-black">
                      {percentual}%
                    </span>
                  </summary>

                  <div className="ml-40 mt-2 flex flex-col gap-1.5 border-l border-brand-gray-300/60 pl-4">
                    {fase.atividades.map((atividade) => (
                      <div
                        key={atividade.id}
                        className="flex items-center justify-between gap-3 text-xs text-brand-gray-700"
                      >
                        <span className="flex-1">{atividade.descricao}</span>
                        <AtividadeStatusSelect atividadeId={atividade.id} status={atividade.status} />
                      </div>
                    ))}
                    {fase.atividades.length === 0 && (
                      <p className="text-xs text-brand-gray-500">Sem atividades nesta fase.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
