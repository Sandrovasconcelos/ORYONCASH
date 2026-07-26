"use client";

import { useRouter } from "next/navigation";
import type { ObraResumida } from "@/lib/dashboard/queries";

export function ObraSelector({
  obras,
  obraAtualId,
}: {
  obras: ObraResumida[];
  obraAtualId: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/15 text-lg">
          🏗️
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Selecionar Obra
          </p>
          <p className="text-xs text-zinc-500">
            Escolha o projeto para visualizar
          </p>
        </div>
      </div>

      <select
        value={obraAtualId}
        onChange={(e) => router.push(`/dashboard?obra=${e.target.value}`)}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-64"
      >
        {obras.map((obra) => (
          <option key={obra.id} value={obra.id}>
            {obra.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
