import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { hojeNoBrasil } from "@/lib/conversation/queries";

export const dynamic = "force-dynamic";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const NOMES_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function ultimoDiaDoMes(ano: number, mesIndex0: number): number {
  return new Date(Date.UTC(ano, mesIndex0 + 1, 0)).getUTCDate();
}

/** Interpola de laranja (gasto baixo) pra vermelho (gasto alto), t em [0,1]. */
function corIntensidade(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Laranja #f59e0b (245,158,11) -> Vermelho #dc2626 (220,38,38)
  const r = Math.round(245 + (220 - 245) * clamped);
  const g = Math.round(158 + (38 - 158) * clamped);
  const b = Math.round(11 + (38 - 11) * clamped);
  return `rgb(${r} ${g} ${b})`;
}

export default async function CalendarioGastosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; obra?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const hoje = hojeNoBrasil();
  const mesParam = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : hoje.slice(0, 7);
  const [anoStr, mesStr] = mesParam.split("-");
  const ano = Number(anoStr);
  const mesIndex0 = Number(mesStr) - 1;

  const primeiroDia = `${mesParam}-01`;
  const ultimoDia = `${mesParam}-${String(ultimoDiaDoMes(ano, mesIndex0)).padStart(2, "0")}`;

  const mesAnterior = new Date(Date.UTC(ano, mesIndex0 - 1, 1));
  const mesSeguinte = new Date(Date.UTC(ano, mesIndex0 + 1, 1));
  const chaveMesAnterior = `${mesAnterior.getUTCFullYear()}-${String(mesAnterior.getUTCMonth() + 1).padStart(2, "0")}`;
  const chaveMesSeguinte = `${mesSeguinte.getUTCFullYear()}-${String(mesSeguinte.getUTCMonth() + 1).padStart(2, "0")}`;

  const [{ data: obras }, despesasQuery] = await Promise.all([
    supabase.from("obras").select("id, nome").is("deleted_at", null).order("nome"),
    (async () => {
      let query = supabase
        .from("despesas")
        .select("data, valor")
        .is("deleted_at", null)
        .gte("data", primeiroDia)
        .lte("data", ultimoDia);
      if (params.obra) query = query.eq("obra_id", params.obra);
      return query;
    })(),
  ]);

  const despesas = despesasQuery.data ?? [];

  const totalPorDia = new Map<string, number>();
  for (const d of despesas) {
    totalPorDia.set(d.data, (totalPorDia.get(d.data) ?? 0) + Number(d.valor));
  }

  const totalMes = [...totalPorDia.values()].reduce((soma, v) => soma + v, 0);
  const maiorDia = Math.max(0, ...totalPorDia.values());
  const diaComMaisGasto = [...totalPorDia.entries()].sort((a, b) => b[1] - a[1])[0];

  const totalDias = ultimoDiaDoMes(ano, mesIndex0);
  const primeiroDiaSemana = new Date(Date.UTC(ano, mesIndex0, 1)).getUTCDay();

  const celulas: ({ dia: number; dataISO: string } | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= totalDias; dia++) {
    const dataISO = `${mesParam}-${String(dia).padStart(2, "0")}`;
    celulas.push({ dia, dataISO });
  }
  while (celulas.length % 7 !== 0) celulas.push(null);

  const linkComMes = (mes: string) => {
    const sp = new URLSearchParams();
    sp.set("mes", mes);
    if (params.obra) sp.set("obra", params.obra);
    return `/dashboard/despesas/calendario?${sp.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-brand-black">Calendário de gastos</h1>
          <p className="mt-1 text-sm text-brand-gray-600">
            Quanto mais vermelho o dia, maior foi o gasto — quanto mais laranja, menor.
          </p>
        </div>
        <Link
          href="/dashboard/despesas"
          className="shrink-0 rounded-brand-sm border border-brand-gray-300 bg-white px-4 py-2 text-sm font-semibold text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
        >
          Ver lançamentos
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={linkComMes(chaveMesAnterior)}
            className="flex h-9 w-9 items-center justify-center rounded-brand-sm border border-brand-gray-300 text-brand-gray-600 hover:border-brand-red/40 hover:text-brand-red"
            aria-label="Mês anterior"
          >
            ←
          </Link>
          <h2 className="w-48 text-center text-lg font-extrabold text-brand-black">
            {NOMES_MES[mesIndex0]} de {ano}
          </h2>
          <Link
            href={linkComMes(chaveMesSeguinte)}
            className="flex h-9 w-9 items-center justify-center rounded-brand-sm border border-brand-gray-300 text-brand-gray-600 hover:border-brand-red/40 hover:text-brand-red"
            aria-label="Próximo mês"
          >
            →
          </Link>
        </div>

        <form className="flex items-end gap-3">
          <input type="hidden" name="mes" value={mesParam} />
          <label className="flex flex-col gap-1 text-xs font-semibold text-brand-gray-500">
            Obra
            <select
              name="obra"
              defaultValue={params.obra ?? ""}
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm font-normal text-brand-black outline-none focus:border-brand-red"
            >
              <option value="">Todas as obras</option>
              {(obras ?? []).map((obra) => (
                <option key={obra.id} value={obra.id}>
                  {obra.nome}
                </option>
              ))}
            </select>
          </label>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gray-500">Total no mês</p>
          <p className="mt-1 text-xl font-extrabold text-brand-black">{formatBRL(totalMes)}</p>
        </div>
        <div className="rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gray-500">Dia com mais gasto</p>
          <p className="mt-1 text-xl font-extrabold text-brand-black">
            {diaComMaisGasto
              ? `${diaComMaisGasto[0].split("-")[2]}/${mesStr} — ${formatBRL(diaComMaisGasto[1])}`
              : "—"}
          </p>
        </div>
        <div className="rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gray-500">Dias com gasto</p>
          <p className="mt-1 text-xl font-extrabold text-brand-black">{totalPorDia.size} de {totalDias}</p>
        </div>
      </div>

      <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
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
            const totalDia = totalPorDia.get(celula.dataISO) ?? 0;
            const temGasto = totalDia > 0;
            const intensidade = maiorDia > 0 ? totalDia / maiorDia : 0;
            const isHoje = celula.dataISO === hoje;

            return (
              <Link
                key={celula.dataISO}
                href={`/dashboard/despesas?data=${celula.dataISO}`}
                className={`flex aspect-square flex-col justify-between rounded-brand-sm border p-2 transition hover:brightness-95 ${
                  isHoje ? "border-brand-black" : "border-black/5"
                }`}
                style={temGasto ? { backgroundColor: corIntensidade(intensidade) } : undefined}
                title={temGasto ? `${formatBRL(totalDia)} em ${celula.dia}/${mesStr}` : `Sem gastos em ${celula.dia}/${mesStr}`}
              >
                <span
                  className={`text-xs font-bold ${
                    temGasto ? "text-white drop-shadow-sm" : "text-brand-gray-600"
                  }`}
                >
                  {celula.dia}
                </span>
                {temGasto && (
                  <span className="text-right text-[10px] font-extrabold leading-tight text-white drop-shadow-sm">
                    {formatBRL(totalDia)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 text-[10px] font-bold text-brand-gray-500">
          <span>Menos gasto</span>
          <span className="flex h-3 w-24 overflow-hidden rounded-full">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="flex-1" style={{ backgroundColor: corIntensidade(i / 11) }} />
            ))}
          </span>
          <span>Mais gasto</span>
        </div>
      </div>
    </div>
  );
}
