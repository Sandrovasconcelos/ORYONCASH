"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type SelecaoContextValue = {
  selecionados: Set<string>;
  toggle: (id: string) => void;
  toggleTodos: (ids: string[]) => void;
  limpar: () => void;
};

const SelecaoContext = createContext<SelecaoContextValue | null>(null);

export function SelecaoLancamentosProvider({ children }: { children: React.ReactNode }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  const toggleTodos = useCallback((ids: string[]) => {
    setSelecionados((atual) => {
      const todosMarcados = ids.length > 0 && ids.every((id) => atual.has(id));
      const novo = new Set(atual);
      for (const id of ids) {
        if (todosMarcados) novo.delete(id);
        else novo.add(id);
      }
      return novo;
    });
  }, []);

  const limpar = useCallback(() => setSelecionados(new Set()), []);

  const value = useMemo(
    () => ({ selecionados, toggle, toggleTodos, limpar }),
    [selecionados, toggle, toggleTodos, limpar]
  );

  return <SelecaoContext.Provider value={value}>{children}</SelecaoContext.Provider>;
}

export function useSelecaoLancamentos() {
  const ctx = useContext(SelecaoContext);
  if (!ctx) {
    throw new Error("useSelecaoLancamentos precisa estar dentro de SelecaoLancamentosProvider");
  }
  return ctx;
}
