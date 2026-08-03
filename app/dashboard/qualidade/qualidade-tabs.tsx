"use client";

import { useState } from "react";

const ABAS = [
  { id: "etapas", label: "Etapas desta obra", descricao: "Checklist e situação de qualidade" },
  { id: "modelos", label: "Modelos de checklist", descricao: "Templates reutilizáveis" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

export function QualidadeTabs({
  etapasPanel,
  modelosPanel,
}: {
  etapasPanel: React.ReactNode;
  modelosPanel: React.ReactNode;
}) {
  const [aba, setAba] = useState<AbaId>("etapas");
  const paineis: Record<AbaId, React.ReactNode> = {
    etapas: etapasPanel,
    modelos: modelosPanel,
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Seções de qualidade"
        className="grid grid-cols-1 gap-2 rounded-card border border-brand-gray-300/60 bg-white p-2 shadow-card sm:grid-cols-2"
      >
        {ABAS.map((item) => {
          const ativo = aba === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setAba(item.id)}
              className={
                ativo
                  ? "rounded-brand-sm bg-brand-black px-4 py-3 text-left text-white shadow-[0_12px_24px_rgba(17,19,23,.14)]"
                  : "rounded-brand-sm px-4 py-3 text-left text-brand-gray-500 hover:bg-brand-gray-100 hover:text-brand-black"
              }
            >
              <span className="block text-sm font-extrabold">{item.label}</span>
              <span className={ativo ? "mt-0.5 block text-xs text-white/62" : "mt-0.5 block text-xs"}>
                {item.descricao}
              </span>
            </button>
          );
        })}
      </div>

      {paineis[aba]}
    </div>
  );
}
