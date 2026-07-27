"use client";

import type { ReactNode } from "react";

export function OpenDespesaModalButton({
  despesaId,
  children,
}: {
  despesaId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const trigger = document.querySelector<HTMLButtonElement>(
          `[data-modal-trigger-id="despesa-${despesaId}"]`
        );
        trigger?.click();
      }}
      className="block w-full rounded-brand-sm text-left outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-red/40"
      aria-label="Abrir detalhes do lançamento"
      title="Abrir detalhes do lançamento"
    >
      {children}
    </button>
  );
}
