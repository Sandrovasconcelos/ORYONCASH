import Link from "next/link";
import { formatBRL } from "@/lib/conversation/format";
import type { CategoriaBreakdown, EtapaBreakdown } from "@/lib/dashboard/queries";

type Item = CategoriaBreakdown | EtapaBreakdown;

function temOrcamento(item: Item): item is EtapaBreakdown {
  return "valorOrcado" in item && item.valorOrcado !== null && item.valorOrcado! > 0;
}

export function BreakdownList({
  titulo,
  itens,
  getIcon,
  filtroParam,
  obraId,
}: {
  titulo: string;
  itens: Item[];
  getIcon: (nome: string) => string;
  filtroParam: "categoria" | "etapa" | "material";
  obraId: string;
}) {
  return (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
      <p className="text-sm font-semibold text-brand-black mb-4">
        {titulo}
      </p>
      <ul className="flex flex-col gap-1">
        {itens.map((item) => {
          const comOrcamento = temOrcamento(item);
          const estourado = comOrcamento && item.estourado;
          const destacar = estourado || item.maiorGasto;

          const percentualBarra = comOrcamento
            ? (item.total / item.valorOrcado!) * 100
            : item.percentual;

          return (
            <li
              key={item.id}
              className={
                destacar
                  ? estourado
                    ? "rounded-brand-lg border border-status-danger/30 bg-status-danger/5"
                    : "rounded-brand-lg border border-status-warning/30 bg-status-warning/5"
                  : ""
              }
            >
              <Link
                href={`/dashboard/despesas?obra=${obraId}&${filtroParam}=${item.id}`}
                className="flex items-start gap-3 p-3 rounded-brand-lg transition-colors hover:bg-brand-gray-100"
              >
                <div
                  className={
                    destacar
                      ? estourado
                        ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-brand-sm bg-status-danger/15 text-base"
                        : "flex h-9 w-9 shrink-0 items-center justify-center rounded-brand-sm bg-status-warning/15 text-base"
                      : "flex h-9 w-9 shrink-0 items-center justify-center rounded-brand-sm bg-brand-gray-100 text-base"
                  }
                >
                  {getIcon(item.nome)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-sm text-brand-gray-700">
                      {item.nome}
                    </span>
                    <span className="shrink-0 font-semibold text-sm text-brand-black">
                      {formatBRL(item.total)}
                      {comOrcamento && (
                        <span className="ml-1 font-normal text-xs text-brand-gray-500">
                          / {formatBRL(item.valorOrcado!)}
                        </span>
                      )}
                    </span>
                  </div>

                  {estourado && (
                    <span className="mt-1 inline-block rounded-full bg-status-danger/15 px-2 py-0.5 text-[10px] font-semibold text-status-danger">
                      Orçamento estourado
                    </span>
                  )}
                  {!estourado && item.maiorGasto && (
                    <span className="mt-1 inline-block rounded-full bg-status-warning/15 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                      Maior Gasto
                    </span>
                  )}

                  <div className="mt-2 h-1.5 w-full rounded-full bg-brand-gray-100">
                    <div
                      className={
                        estourado
                          ? "h-1.5 rounded-full bg-status-danger"
                          : destacar
                            ? "h-1.5 rounded-full bg-status-warning"
                            : "h-1.5 rounded-full bg-brand-red"
                      }
                      style={{ width: `${Math.min(100, percentualBarra)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-brand-gray-500">
                    {percentualBarra.toFixed(1)}%{" "}
                    {comOrcamento ? "do orçado" : "das despesas"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}

        {itens.length === 0 && (
          <li className="py-6 text-center text-sm text-brand-gray-500">
            Nenhum registro ainda.
          </li>
        )}
      </ul>
    </div>
  );
}
