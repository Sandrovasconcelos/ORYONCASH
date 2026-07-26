"use client";

import { useActionState } from "react";
import {
  importarOrcamentoAction,
  type ImportarOrcamentoResultado,
} from "../actions";
import type { ObraResumida } from "@/lib/dashboard/queries";

const ESTADO_INICIAL: ImportarOrcamentoResultado | null = null;

export function ImportarOrcamentoForm({ obras }: { obras: ObraResumida[] }) {
  const [resultado, formAction, pendente] = useActionState(
    async (_prev: ImportarOrcamentoResultado | null, formData: FormData) =>
      importarOrcamentoAction(formData),
    ESTADO_INICIAL
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex flex-col gap-4 max-w-md"
    >
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Importar Orçamento (.xlsx)
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Sobe a planilha orçamentária da obra. A IA identifica as etapas e
          os valores orçados automaticamente — isso substitui as etapas e o
          orçamento total atuais dessa obra.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Obra
        <select
          name="obra_id"
          required
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          {obras.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Arquivo
        <input
          type="file"
          name="arquivo"
          accept=".xlsx,.xls"
          required
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 dark:file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm"
        />
      </label>

      {resultado?.ok === false && (
        <p className="text-sm text-red-500">{resultado.erro}</p>
      )}
      {resultado?.ok === true && (
        <p className="text-sm text-emerald-600">
          ✅ {resultado.etapas} etapas importadas com sucesso.
        </p>
      )}

      <button
        type="submit"
        disabled={pendente || obras.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pendente ? "Analisando..." : "Importar"}
      </button>
    </form>
  );
}
