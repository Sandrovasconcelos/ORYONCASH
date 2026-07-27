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
      className="rounded-card border border-brand-gray-300/60 bg-white shadow-card p-5 flex flex-col gap-4 max-w-md"
    >
      <div>
        <p className="text-sm font-medium text-brand-black">
          Importar Orçamento (.xlsx)
        </p>
        <p className="text-xs text-brand-gray-500 mt-1">
          Sobe a planilha orçamentária da obra. A IA identifica as etapas e
          os valores orçados automaticamente — isso substitui as etapas e o
          orçamento total atuais dessa obra.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Obra
        <select
          name="obra_id"
          required
          className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
        >
          {obras.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Arquivo
        <input
          type="file"
          name="arquivo"
          accept=".xlsx,.xls"
          required
          className="text-sm file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-gray-100 file:px-3 file:py-1.5 file:text-sm"
        />
      </label>

      {resultado?.ok === false && (
        <p className="text-sm text-status-danger">{resultado.erro}</p>
      )}
      {resultado?.ok === true && (
        <p className="text-sm text-status-success">
          ✅ {resultado.etapas} etapas importadas com sucesso.
        </p>
      )}

      <button
        type="submit"
        disabled={pendente || obras.length === 0}
        className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-700 disabled:opacity-60"
      >
        {pendente ? "Analisando..." : "Importar"}
      </button>
    </form>
  );
}
