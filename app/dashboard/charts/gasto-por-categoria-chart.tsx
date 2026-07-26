"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/conversation/format";

type Item = { nome: string; total: number };

function TooltipConteudo({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Item }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.nome}</p>
      <p className="text-zinc-600 dark:text-zinc-400">{formatBRL(item.total)}</p>
    </div>
  );
}

export function GastoPorCategoriaChart({ itens }: { itens: Item[] }) {
  const dados = [...itens]
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total);

  if (dados.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Sem despesas registradas ainda.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 40)}>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
        barCategoryGap={10}
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--chart-grid)"
          strokeDasharray="0"
        />
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
          width={140}
          tick={{ fill: "var(--chart-ink-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tickLine={false}
        />
        <Tooltip content={<TooltipConteudo />} cursor={{ fill: "var(--chart-grid)" }} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {dados.map((item) => (
            <Cell key={item.nome} fill="var(--chart-1)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
