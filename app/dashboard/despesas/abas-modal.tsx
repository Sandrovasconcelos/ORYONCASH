"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type AbaModal = {
  id: string;
  titulo: string;
  /** Texto curto ao lado do titulo (ex: quantidade de arquivos). */
  selo?: string;
  conteudo: ReactNode;
};

/**
 * Abas para formularios: todos os paineis ficam montados (so escondidos), entao
 * os campos de todas as abas seguem juntos no mesmo <form> ao salvar. Se o
 * navegador barrar o envio por um campo invalido numa aba escondida, abre a
 * aba desse campo pra a mensagem aparecer.
 */
export function AbasModal({ abas, inicial }: { abas: AbaModal[]; inicial?: string }) {
  const [ativa, setAtiva] = useState(inicial ?? abas[0]?.id);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const formulario = raiz.current?.closest("form");
    if (!formulario) return;
    function aoInvalidar(evento: Event) {
      const painel = (evento.target as HTMLElement | null)?.closest<HTMLElement>("[data-aba-id]");
      const id = painel?.dataset.abaId;
      if (id) setAtiva(id);
    }
    formulario.addEventListener("invalid", aoInvalidar, true);
    return () => formulario.removeEventListener("invalid", aoInvalidar, true);
  }, []);

  return (
    <div ref={raiz}>
      <div
        role="tablist"
        className="flex gap-1 rounded-brand-sm border border-brand-gray-300/70 bg-brand-gray-100 p-1"
      >
        {abas.map((aba) => {
          const selecionada = aba.id === ativa;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`aba-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`painel-${aba.id}`}
              onClick={() => setAtiva(aba.id)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-bold transition ${
                selecionada
                  ? "bg-white text-brand-black shadow-sm"
                  : "text-brand-gray-500 hover:text-brand-black"
              }`}
            >
              {aba.titulo}
              {aba.selo && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-extrabold ${
                    selecionada ? "bg-brand-red/10 text-brand-red" : "bg-white text-brand-gray-500"
                  }`}
                >
                  {aba.selo}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {abas.map((aba) => (
        <div
          key={aba.id}
          role="tabpanel"
          id={`painel-${aba.id}`}
          aria-labelledby={`aba-${aba.id}`}
          data-aba-id={aba.id}
          hidden={aba.id !== ativa}
          className="pt-4"
        >
          {aba.conteudo}
        </div>
      ))}
    </div>
  );
}
