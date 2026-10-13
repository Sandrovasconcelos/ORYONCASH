"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useFecharModal } from "../modal-context";

/** Vai dentro de um <form> em modal: fecha o modal quando o envio termina (nome preenchido). */
export function FecharAoTerminar() {
  const { pending, data } = useFormStatus();
  const fechar = useFecharModal();
  const enviado = useRef(false);

  useEffect(() => {
    if (pending && data) {
      enviado.current = String(data.get("nome") ?? "").trim().length > 0;
      return;
    }
    if (!pending && enviado.current) {
      enviado.current = false;
      fechar?.();
    }
  }, [pending, data, fechar]);

  return null;
}
