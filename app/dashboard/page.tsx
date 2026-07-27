import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard/queries";
import { listAtividades } from "@/lib/atividades";
import { formatBRL } from "@/lib/conversation/format";
import { getCategoriaIcon, getEtapaIcon, getMaterialIcon } from "@/lib/dashboard/icons";
import { ObraSelector } from "./obra-selector";
import { BreakdownList } from "./breakdown-list";
import { DashboardTabs } from "./dashboard-tabs";
import { GastoPorCategoriaChart } from "./charts/gasto-por-categoria-chart";
import { OrcadoExecutadoChart } from "./charts/orcado-executado-chart";
import { TendenciaMensalChart } from "./charts/tendencia-mensal-chart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>;
}) {
  const params = await searchParams;
  const [data, atividadesRecentes] = await Promise.all([
    getDashboardData(params.obra ?? null),
    listAtividades(8),
  ]);

  if (!data.obraAtual) {
    return (
      <div className="rounded-card border border-brand-gray-300/60 bg-white p-10 text-center shadow-card">
        <p className="text-3xl">🏗️</p>
        <p className="mt-2 text-brand-gray-700">
          Nenhuma obra cadastrada ainda.
        </p>
        <Link
          href="/dashboard/obras"
          className="mt-3 inline-block text-sm font-medium text-brand-red hover:underline"
        >
          Cadastrar a primeira obra
        </Link>
      </div>
    );
  }

  const { obraAtual } = data;

  const resumo = (
    <div className="flex flex-col gap-6">
      <ObraSelector obras={data.obras} obraAtualId={obraAtual.id} />

      <section className="rounded-card border border-brand-gray-300/60 bg-[#111317] p-5 text-white shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-red">
              Fluxo recomendado
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">
              Cadastre a base antes dos lançamentos
            </h2>
            <p className="mt-1 text-sm text-[#aab0b9]">
              Obras, categorias, materiais e fornecedores alimentam o WhatsApp, os filtros e os relatórios.
            </p>
          </div>
          <Link
            href="/dashboard/despesas"
            className="inline-flex h-10 items-center justify-center rounded-brand-sm bg-white px-4 text-sm font-extrabold text-brand-black hover:bg-brand-red hover:text-white"
          >
            Ver lançamentos
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <CadastroAtalho
            etapa="01"
            titulo="Obras"
            texto="Crie a obra e informe orçamento."
            href="/dashboard/obras"
          />
          <CadastroAtalho
            etapa="02"
            titulo="Categorias"
            texto="Padronize os grupos de gasto."
            href="/dashboard/categorias"
          />
          <CadastroAtalho
            etapa="03"
            titulo="Materiais"
            texto="Cadastre canos, cabos e insumos."
            href="/dashboard/materiais"
          />
          <CadastroAtalho
            etapa="04"
            titulo="Fornecedores"
            texto="Registre lojas e prestadores."
            href="/dashboard/fornecedores"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Orçamento Total" valor={formatBRL(obraAtual.orcamentoTotal)} />
        <Card label="Gasto Total" valor={formatBRL(obraAtual.gastoTotal)} destaque />
        <Card label="Saldo Restante" valor={formatBRL(obraAtual.saldoRestante)} />
        <Card
          label="Investido"
          valor={`${obraAtual.percentualInvestido.toFixed(1)}%`}
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

      <ChartCard titulo="Gasto por Material">
        <GastoPorCategoriaChart itens={data.materiais} />
      </ChartCard>
    </div>
  );

  const detalhes = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <BreakdownList
        titulo="Categorias"
        itens={data.categorias}
        getIcon={getCategoriaIcon}
        filtroParam="categoria"
        obraId={obraAtual.id}
      />
      <BreakdownList
        titulo="Etapas"
        itens={data.etapas}
        getIcon={getEtapaIcon}
        filtroParam="etapa"
        obraId={obraAtual.id}
      />
      <BreakdownList
        titulo="Materiais"
        itens={data.materiais}
        getIcon={getMaterialIcon}
        filtroParam="material"
        obraId={obraAtual.id}
      />
    </div>
  );

  const atividades = (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {atividadesRecentes.map((a) => (
          <li
            key={a.id}
            className="rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card flex items-center justify-between gap-3"
          >
            <span className="text-sm text-brand-black">{a.resumo}</span>
            <span className="shrink-0 text-xs text-brand-gray-500">
              {new Date(a.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </li>
        ))}
        {atividadesRecentes.length === 0 && (
          <li className="rounded-card border border-brand-gray-300/60 bg-white p-8 text-center text-sm text-brand-gray-500">
            Nenhuma atividade registrada ainda.
          </li>
        )}
      </ul>
      <Link
        href="/dashboard/atividades"
        className="text-sm font-medium text-brand-red hover:underline self-start"
      >
        Ver histórico completo →
      </Link>
    </div>
  );

  return <DashboardTabs resumo={resumo} detalhes={detalhes} atividades={atividades} />;
}

function CadastroAtalho({
  etapa,
  titulo,
  texto,
  href,
}: {
  etapa: string;
  titulo: string;
  texto: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/[.08] bg-white/[.04] p-4 text-left hover:border-brand-red/50 hover:bg-white/[.07]"
    >
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-red">
        {etapa}
      </span>
      <p className="mt-2 text-sm font-extrabold text-white">{titulo}</p>
      <p className="mt-1 text-xs leading-5 text-[#aab0b9]">{texto}</p>
    </Link>
  );
}

function Card({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
      <p className="text-xs font-medium text-brand-gray-500">{label}</p>
      <p
        className={
          destaque
            ? "mt-1 font-display text-2xl font-semibold tracking-tight text-brand-red"
            : "mt-1 font-display text-2xl font-semibold tracking-tight text-brand-black"
        }
      >
        {valor}
      </p>
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
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
      <p className="text-sm font-semibold text-brand-black mb-4">
        {titulo}
      </p>
      {children}
    </div>
  );
}
