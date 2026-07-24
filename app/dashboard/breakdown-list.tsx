import { formatBRL } from "@/lib/conversation/format";
import type { CategoriaBreakdown } from "@/lib/dashboard/queries";

export function BreakdownList({
  titulo,
  itens,
}: {
  titulo: string;
  itens: CategoriaBreakdown[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-4">
        {titulo}
      </p>
      <ul className="flex flex-col gap-4">
        {itens.map((item) => (
          <li
            key={item.id}
            className={
              item.maiorGasto
                ? "rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3"
                : "p-3"
            }
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                {item.nome}
                {item.maiorGasto && (
                  <span className="ml-2 rounded-full bg-amber-200 dark:bg-amber-900 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                    Maior Gasto
                  </span>
                )}
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                {formatBRL(item.total)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={
                  item.maiorGasto
                    ? "h-1.5 rounded-full bg-emerald-500"
                    : "h-1.5 rounded-full bg-blue-500"
                }
                style={{ width: `${Math.min(100, item.percentual)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {item.percentual.toFixed(1)}% das despesas
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
