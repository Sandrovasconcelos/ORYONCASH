"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/conversation/format";

type Ponto = { mes: string; valor: number };

function TooltipConteudo({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Ponto }[];
}) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload;
  return (
    <div className="rounded-brand-sm border border-brand-gray-300/60 bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-brand-black">{ponto.mes}</p>
      <p className="text-brand-gray-500">{formatBRL(ponto.valor)}</p>
    </div>
  );
}

export function TendenciaMensalChart({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-brand-gray-500">
        Sem despesas registradas ainda.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={pontos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gastoMensalGradiente" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          width={80}
        />
        <Tooltip content={<TooltipConteudo />} cursor={{ stroke: "var(--chart-axis)" }} />
        <Area
          type="monotone"
          dataKey="valor"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#gastoMensalGradiente)"
          dot={{ r: 4, fill: "var(--chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
