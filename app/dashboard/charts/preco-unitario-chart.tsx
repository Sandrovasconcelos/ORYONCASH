"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/conversation/format";

type Ponto = { data: string; valorUnitario: number; fornecedorNome: string };

function TooltipConteudo({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload;
  return (
    <div className="rounded-brand-sm border border-brand-gray-300/60 bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-brand-black">{ponto.data}</p>
      <p className="text-brand-gray-500">{formatBRL(ponto.valorUnitario)}</p>
      <p className="text-brand-gray-400">{ponto.fornecedorNome}</p>
    </div>
  );
}

export function PrecoUnitarioChart({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-brand-gray-500">
        Sem lançamentos com valor unitário registrado ainda.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={pontos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="data"
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
        <Line
          type="monotone"
          dataKey="valorUnitario"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
