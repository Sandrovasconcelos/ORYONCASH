"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useFecharModal } from "./modal-context";

/** Vai dentro de um <form> em modal: fecha o modal quando o envio termina. */
export function FecharAoEnviar() {
  const { pending } = useFormStatus();
  const fechar = useFecharModal();
  const enviou = useRef(false);

  useEffect(() => {
    if (pending) {
      enviou.current = true;
      return;
    }
    if (enviou.current) {
      enviou.current = false;
      fechar?.();
    }
  }, [pending, fechar]);

  return null;
}
