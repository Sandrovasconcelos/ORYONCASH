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
    <div className="flex flex-col gap-4 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-sm bg-brand-red/10 text-lg">
          🏗️
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-black">
            Selecionar Obra
          </p>
          <p className="text-xs text-brand-gray-500">
            Escolha o projeto para visualizar
          </p>
        </div>
      </div>

      <select
        value={obraAtualId}
        onChange={(e) => router.push(`/dashboard?obra=${e.target.value}`)}
        className="w-full rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red sm:w-64"
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
