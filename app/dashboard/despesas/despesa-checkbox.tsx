"use client";

import { useSelecaoLancamentos } from "./selecao-context";

export function DespesaCheckbox({ id }: { id: string }) {
  const { selecionados, toggle } = useSelecaoLancamentos();
  return (
    <input
      type="checkbox"
      checked={selecionados.has(id)}
      onChange={() => toggle(id)}
      className="h-4 w-4 accent-brand-red"
      aria-label="Selecionar lançamento"
    />
  );
}

export function SelecionarTodosCheckbox({ ids }: { ids: string[] }) {
  const { selecionados, toggleTodos } = useSelecaoLancamentos();
  const todosMarcados = ids.length > 0 && ids.every((id) => selecionados.has(id));
  return (
    <input
      type="checkbox"
      checked={todosMarcados}
      onChange={() => toggleTodos(ids)}
      className="h-4 w-4 accent-brand-red"
      aria-label="Selecionar todos os lançamentos desta página"
    />
  );
}
