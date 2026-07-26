import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard/queries";
import { formatBRL } from "@/lib/conversation/format";
import { getCategoriaIcon, getEtapaIcon } from "@/lib/dashboard/icons";
import { ObraSelector } from "./obra-selector";
import { BreakdownList } from "./breakdown-list";
import { GastoPorCategoriaChart } from "./charts/gasto-por-categoria-chart";
import { OrcadoExecutadoChart } from "./charts/orcado-executado-chart";
import { TendenciaMensalChart } from "./charts/tendencia-mensal-chart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params.obra ?? null);

  if (!data.obraAtual) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-10 text-center">
        <p className="text-3xl">🏗️</p>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">
          Nenhuma obra cadastrada ainda.
        </p>
        <Link
          href="/dashboard/obras"
          className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Cadastrar a primeira obra
        </Link>
      </div>
    );
  }

  const { obraAtual } = data;

  return (
    <div className="flex flex-col gap-6">
      <ObraSelector obras={data.obras} obraAtualId={obraAtual.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon="💰"
          label="Orçamento Total"
          valor={formatBRL(obraAtual.orcamentoTotal)}
          cor="from-blue-600 to-blue-500"
        />
        <Card
          icon="📉"
          label="Gasto Total"
          valor={formatBRL(obraAtual.gastoTotal)}
          cor="from-blue-500 to-sky-400"
        />
        <Card
          icon="💵"
          label="Saldo Restante"
          valor={formatBRL(obraAtual.saldoRestante)}
          cor="from-emerald-600 to-emerald-500"
        />
        <Card
          icon="📊"
          label="Investido"
          valor={`${obraAtual.percentualInvestido.toFixed(1)}%`}
          cor="from-blue-500 to-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard titulo="Gasto por Categoria">
          <GastoPorCategoriaChart itens={data.categorias} />
        </ChartCard>
        <ChartCard titulo="Orçado x Executado por Etapa">
          <OrcadoExecutadoChart itens={data.etapas} />
        </ChartCard>
      </div>

      <ChartCard titulo="Gasto ao Longo do Tempo">
        <TendenciaMensalChart pontos={data.tendenciaMensal} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownList
          titulo="Categorias"
          itens={data.categorias}
          getIcon={getCategoriaIcon}
        />
        <BreakdownList
          titulo="Etapas"
          itens={data.etapas}
          getIcon={getEtapaIcon}
        />
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  valor,
  cor,
}: {
  icon: string;
  label: string;
  valor: string;
  cor: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${cor} p-5 text-white shadow-sm transition-transform hover:-translate-y-0.5`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-base">
        {icon}
      </div>
      <p className="mt-3 text-xs font-medium text-white/85">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{valor}</p>
    </div>
  );
}

function ChartCard({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-sm">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        {titulo}
      </p>
      {children}
    </div>
  );
}
