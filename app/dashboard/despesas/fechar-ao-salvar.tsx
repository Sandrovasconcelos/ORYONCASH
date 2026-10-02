"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { parseValorBR } from "@/lib/conversation/format";
import { useFecharModal } from "../modal-context";

/**
 * Vai dentro do <form> do "Novo lançamento": quando o envio termina e os
 * dados eram válidos (valor positivo e categoria), fecha o modal. Se a ação
 * ignorou o envio por dados inválidos, o modal fica aberto pra corrigir.
 */
export function FecharAoSalvar() {
  const { pending, data } = useFormStatus();
  const fechar = useFecharModal();
  const enviado = useRef<{ valido: boolean } | null>(null);

  useEffect(() => {
    if (pending && data) {
      const valor = parseValorBR(String(data.get("valor") ?? ""));
      const categoria = String(data.get("categoria_id") ?? "");
      enviado.current = { valido: valor !== null && Boolean(categoria) };
      return;
    }
    if (!pending && enviado.current) {
      const { valido } = enviado.current;
      enviado.current = null;
      if (valido) fechar?.();
    }
  }, [pending, data, fechar]);

  return null;
}
