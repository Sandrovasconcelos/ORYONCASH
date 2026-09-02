"use client";

import { useRef } from "react";

const STATUS_CLASSE: Record<string, string> = {
  pendente: "bg-brand-gray-100 text-brand-gray-700",
  concluida: "bg-[#e9f8f0] text-status-success",
  atrasada: "bg-status-danger/15 text-status-danger",
};

export function TarefaStatusSelect({
  tarefaId,
  etapaId,
  statusAtual,
  action,
}: {
  tarefaId: string;
  etapaId: string;
  statusAtual: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="tarefa_id" value={tarefaId} />
      <input type="hidden" name="etapa_id" value={etapaId} />
      <select
        name="status"
        defaultValue={statusAtual}
        onChange={() => formRef.current?.requestSubmit()}
        className={`rounded-full border-0 px-2 py-1 text-xs font-bold ${STATUS_CLASSE[statusAtual] ?? STATUS_CLASSE.pendente}`}
      >
        <option value="pendente">Pendente</option>
        <option value="concluida">Concluída</option>
        <option value="atrasada">Atrasada</option>
      </select>
    </form>
  );
}
