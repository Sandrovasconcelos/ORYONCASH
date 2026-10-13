"use client";

export function ImprimirBotao() {
  return (
    <button type="button" onClick={() => window.print()} className="oc-button oc-button-soft text-xs print:hidden">
      Imprimir / salvar em PDF
    </button>
  );
}
