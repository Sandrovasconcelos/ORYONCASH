"use client";

import { createContext, useContext } from "react";

/** Deixa um formulario dentro do CadastroModal fechar o proprio modal (ex: depois de salvar). */
export const FecharModalContext = createContext<(() => void) | null>(null);

export function useFecharModal() {
  return useContext(FecharModalContext);
}
