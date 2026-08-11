"use client";

import { useSelecaoLancamentos } from "./selecao-context";

export function SelecaoActionBar() {
  const { selecionados, limpar } = useSelecaoLancamentos();
  const ids = Array.from(selecionados);

  if (ids.length === 0) return null;

  const idsParam = ids.join(",");

  return (
    <div className="fixed bottom-6 left-1/2 z-30 flex w-fit -translate-x-1/2 items-center gap-3 rounded-full border border-brand-gray-300/60 bg-brand-black px-5 py-3 text-white shadow-[0_18px_40px_rgba(17,19,23,.35)]">
      <span className="whitespace-nowrap text-sm font-semibold">
        {ids.length} selecionado(s)
      </span>
      <a
        href={`/api/despesas/zip?ids=${idsParam}`}
        className="whitespace-nowrap rounded-brand-sm bg-brand-red px-3 py-1.5 text-xs font-bold hover:bg-brand-red-700"
      >
        ⬇️ Baixar ZIP
      </a>
      <a
        href={`/dashboard/despesas/relatorio?ids=${idsParam}`}
        className="whitespace-nowrap rounded-brand-sm border border-white/25 px-3 py-1.5 text-xs font-bold hover:border-white/50"
      >
        📄 Gerar relatório
      </a>
      <button
        type="button"
        onClick={limpar}
        className="whitespace-nowrap text-xs font-semibold text-brand-gray-300 hover:text-white"
      >
        Limpar
      </button>
    </div>
  );
}
