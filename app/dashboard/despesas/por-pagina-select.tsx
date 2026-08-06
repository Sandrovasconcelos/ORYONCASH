"use client";

export function PorPaginaSelect({ valor }: { valor: number }) {
  return (
    <select
      name="porPagina"
      defaultValue={String(valor)}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm font-normal text-brand-black outline-none focus:border-brand-red"
    >
      <option value="10">Exibir 10</option>
      <option value="20">Exibir 20</option>
      <option value="50">Exibir 50</option>
      <option value="100">Exibir 100</option>
    </select>
  );
}
