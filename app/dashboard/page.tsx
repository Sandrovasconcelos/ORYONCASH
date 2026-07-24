import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard/queries";
import { formatBRL } from "@/lib/conversation/format";
import { ObraSelector } from "./obra-selector";
import { BreakdownList } from "./breakdown-list";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params.obra ?? null);

  if (!data.obraAtual) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 text-center">
        <p className="text-zinc-700 dark:text-zinc-300">
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
          label="Orçamento Total"
          valor={formatBRL(obraAtual.orcamentoTotal)}
          cor="bg-blue-600"
        />
        <Card
          label="Gasto Total"
          valor={formatBRL(obraAtual.gastoTotal)}
          cor="bg-blue-500"
        />
        <Card
          label="Saldo Restante"
          valor={formatBRL(obraAtual.saldoRestante)}
          cor="bg-emerald-600"
        />
        <Card
          label="Investido"
          valor={`${obraAtual.percentualInvestido.toFixed(1)}%`}
          cor="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownList titulo="Categorias" itens={data.categorias} />
        <BreakdownList titulo="Etapas" itens={data.etapas} />
      </div>
    </div>
  );
}

function Card({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className={`rounded-2xl ${cor} p-5 text-white shadow-sm`}>
      <p className="text-xs opacity-90">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
    </div>
  );
}
