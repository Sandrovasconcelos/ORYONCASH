"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/conversation/format";

type Ponto = { mes: string; previsto: number; realizado: number };

function TooltipConteudo({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-brand-sm border border-brand-gray-300/60 bg-white px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold text-brand-black">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="text-brand-gray-700">{formatBRL(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function CurvaSChart({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-brand-gray-500">
        Preencha datas previstas nas etapas pra ver a curva de previsto x realizado.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={pontos} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="mes"
          tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatBRL(v)}
          tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tickLine={false}
          width={90}
        />
        <Tooltip content={<TooltipConteudo />} cursor={{ stroke: "var(--chart-axis)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--chart-ink-secondary)" }} />
        <Line
          type="monotone"
          dataKey="previsto"
          name="Previsto"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="realizado"
          name="Realizado"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--chart-2)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
