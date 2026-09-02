"use client";

import { useRef, useState } from "react";
import { ActionIcon } from "../action-icon";
import { SubmitButton } from "../submit-button";

const STATUS_CLASSE: Record<string, string> = {
  pendente: "bg-brand-gray-100 text-brand-gray-700",
  concluida: "bg-[#e9f8f0] text-status-success",
  atrasada: "bg-status-danger/15 text-status-danger",
};

type Acao = (formData: FormData) => void | Promise<void>;

export function TarefaLinha({
  tarefaId,
  etapaId,
  descricao,
  status,
  onAtualizarStatus,
  onAtualizarDescricao,
  onExcluir,
}: {
  tarefaId: string;
  etapaId: string;
  descricao: string;
  status: string;
  onAtualizarStatus: Acao;
  onAtualizarDescricao: Acao;
  onExcluir: Acao;
}) {
  const [editando, setEditando] = useState(false);
  const statusFormRef = useRef<HTMLFormElement>(null);

  if (editando) {
    return (
      <form
        action={onAtualizarDescricao}
        className="flex items-center gap-2 rounded-brand-sm border border-brand-red/40 p-2 text-xs"
        onSubmit={() => setEditando(false)}
      >
        <input type="hidden" name="tarefa_id" value={tarefaId} />
        <input type="hidden" name="etapa_id" value={etapaId} />
        <input name="descricao" defaultValue={descricao} required autoFocus className="oc-input flex-1" />
        <SubmitButton className="oc-button oc-button-primary shrink-0 py-1.5 text-xs">Salvar</SubmitButton>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="shrink-0 text-brand-gray-400 hover:text-brand-black"
        >
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-brand-sm border border-brand-gray-300/60 p-2 text-xs">
      <span className={`flex-1 ${status === "concluida" ? "text-brand-gray-400 line-through" : "text-brand-black"}`}>
        {descricao}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <form ref={statusFormRef} action={onAtualizarStatus}>
          <input type="hidden" name="tarefa_id" value={tarefaId} />
          <input type="hidden" name="etapa_id" value={etapaId} />
          <select
            key={status}
            name="status"
            defaultValue={status}
            onChange={() => statusFormRef.current?.requestSubmit()}
            className={`rounded-full border-0 px-2 py-1 text-xs font-bold ${STATUS_CLASSE[status] ?? STATUS_CLASSE.pendente}`}
          >
            <option value="pendente">Pendente</option>
            <option value="concluida">Concluída</option>
            <option value="atrasada">Atrasada</option>
          </select>
        </form>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-brand-gray-400 hover:text-brand-black"
          title="Editar tarefa"
        >
          <ActionIcon name="edit" />
        </button>
        <form action={onExcluir}>
          <input type="hidden" name="tarefa_id" value={tarefaId} />
          <input type="hidden" name="etapa_id" value={etapaId} />
          <button type="submit" className="text-brand-gray-400 hover:text-status-danger" title="Remover tarefa">
            <ActionIcon name="trash" />
          </button>
        </form>
      </div>
    </div>
  );
}
