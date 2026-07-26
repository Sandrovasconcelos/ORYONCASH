import { formatBRL } from "@/lib/conversation/format";
import type { CategoriaBreakdown } from "@/lib/dashboard/queries";

export function BreakdownList({
  titulo,
  itens,
  getIcon,
}: {
  titulo: string;
  itens: CategoriaBreakdown[];
  getIcon: (nome: string) => string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-sm">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        {titulo}
      </p>
      <ul className="flex flex-col gap-1">
        {itens.map((item) => (
          <li
            key={item.id}
            className={
              item.maiorGasto
                ? "rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20 p-3"
                : "p-3"
            }
          >
            <div className="flex items-start gap-3">
              <div
                className={
                  item.maiorGasto
                    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 text-base"
                    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-base"
                }
              >
                {getIcon(item.nome)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-sm text-zinc-800 dark:text-zinc-100">
                    {item.nome}
                  </span>
                  <span className="shrink-0 font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                    {formatBRL(item.total)}
                  </span>
                </div>

                {item.maiorGasto && (
                  <span className="mt-1 inline-block rounded-full bg-amber-200 dark:bg-amber-900 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                    Maior Gasto
                  </span>
                )}

                <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={
                      item.maiorGasto
                        ? "h-1.5 rounded-full bg-amber-500"
                        : "h-1.5 rounded-full bg-blue-500"
                    }
                    style={{ width: `${Math.min(100, item.percentual)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {item.percentual.toFixed(1)}% das despesas
                </p>
              </div>
            </div>
          </li>
        ))}

        {itens.length === 0 && (
          <li className="py-6 text-center text-sm text-zinc-500">
            Nenhum registro ainda.
          </li>
        )}
      </ul>
    </div>
  );
}
