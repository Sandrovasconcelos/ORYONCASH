"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/conversation/format";

type Item = { nome: string; total: number; valorOrcado: number | null };

function TooltipConteudo({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="text-zinc-700 dark:text-zinc-300">{formatBRL(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function OrcadoExecutadoChart({ itens }: { itens: Item[] }) {
  const dados = itens
    .filter((i) => i.valorOrcado !== null && i.valorOrcado > 0)
    .map((i) => ({ nome: i.nome, Orçado: i.valorOrcado!, Executado: i.total }));

  if (dados.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Importe um orçamento por etapa para ver essa comparação.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, dados.length * 56)}>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
        barGap={4}
      >
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis
          type="number"
          tickFormatter={(v) => formatBRL(v)}
          tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="nome"
          width={160}
          tick={{ fill: "var(--chart-ink-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tickLine={false}
        />
        <Tooltip content={<TooltipConteudo />} cursor={{ fill: "var(--chart-grid)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "var(--chart-ink-secondary)" }}
        />
        <Bar dataKey="Orçado" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={16} />
        <Bar dataKey="Executado" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
