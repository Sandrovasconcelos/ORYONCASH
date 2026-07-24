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
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Selecionar Obra
      </p>
      <p className="text-xs text-zinc-500 mb-3">
        Escolha o projeto para visualizar
      </p>
      <select
        value={obraAtualId}
        onChange={(e) => router.push(`/dashboard?obra=${e.target.value}`)}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
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
