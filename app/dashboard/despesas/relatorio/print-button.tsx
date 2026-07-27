"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="oc-button oc-button-dark"
    >
      <span aria-hidden="true">⎙</span>
      Imprimir / Salvar PDF
    </button>
  );
}
