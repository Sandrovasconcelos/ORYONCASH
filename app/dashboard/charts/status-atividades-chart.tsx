"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Status = "a_fazer" | "em_andamento" | "concluida";

const STATUS_CONFIG: Record<Status, { label: string; cor: string }> = {
  concluida: { label: "Concluída", cor: "var(--status-success)" },
  em_andamento: { label: "Em andamento", cor: "var(--status-warning)" },
  a_fazer: { label: "A fazer", cor: "var(--brand-gray-300)" },
};

const ORDEM: Status[] = ["concluida", "em_andamento", "a_fazer"];

type Item = { payload: { status: Status; label: string; quantidade: number } };

function TooltipConteudo({ active, payload }: { active?: boolean; payload?: Item[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-brand-sm border border-brand-gray-300/60 bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-brand-black">{item.label}</p>
      <p className="text-brand-gray-500">{item.quantidade} atividade(s)</p>
    </div>
  );
}

export function StatusAtividadesChart({
  contagem,
}: {
  contagem: Record<Status, number>;
}) {
  const dados = ORDEM.map((status) => ({
    status,
    label: STATUS_CONFIG[status].label,
    quantidade: contagem[status] ?? 0,
  })).filter((d) => d.quantidade > 0);

  const total = dados.reduce((soma, d) => soma + d.quantidade, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-brand-gray-500">
        Nenhuma atividade cadastrada ainda.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="quantidade"
          nameKey="label"
          innerRadius={56}
          outerRadius={84}
          paddingAngle={2}
          stroke="var(--chart-surface, #fff)"
          strokeWidth={2}
        >
          {dados.map((d) => (
            <Cell key={d.status} fill={STATUS_CONFIG[d.status].cor} />
          ))}
        </Pie>
        <Tooltip content={<TooltipConteudo />} />
        <Legend
          verticalAlign="bottom"
          wrapperStyle={{ fontSize: 12, color: "var(--chart-ink-secondary)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
