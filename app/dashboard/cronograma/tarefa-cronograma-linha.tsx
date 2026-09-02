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

export function TarefaCronogramaLinha({
  tarefaId,
  etapaId,
  descricao,
  status,
  mesPlanejado,
  dataConclusaoReal,
  dataFimPrevista,
  onAtualizarStatus,
  onAtualizarData,
  onAtualizarDescricao,
  onExcluir,
}: {
  tarefaId: string;
  etapaId: string;
  descricao: string;
  status: string;
  mesPlanejado: string;
  dataConclusaoReal: string | null;
  dataFimPrevista: string | null;
  onAtualizarStatus: Acao;
  onAtualizarData: Acao;
  onAtualizarDescricao: Acao;
  onExcluir: Acao;
}) {
  const [editando, setEditando] = useState(false);
  const statusFormRef = useRef<HTMLFormElement>(null);
  const dataFormRef = useRef<HTMLFormElement>(null);

  const atrasada = Boolean(dataConclusaoReal && dataFimPrevista && dataConclusaoReal > dataFimPrevista);
  const situacao =
    status !== "concluida" ? (
      <span className="font-bold text-brand-gray-500">⚪ Em aberto</span>
    ) : atrasada ? (
      <span className="font-bold text-status-danger">🔴 Atrasada (foi pro mês seguinte)</span>
    ) : (
      <span className="font-bold text-status-success">🟢 No prazo</span>
    );

  if (editando) {
    return (
      <tr className="border-t border-brand-red/40 bg-brand-red/5">
        <td colSpan={5} className="py-2">
          <form
            action={onAtualizarDescricao}
            className="flex items-center gap-2 px-1 text-xs"
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
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-brand-gray-300/40">
      <td className="py-2 pr-3 text-brand-black">
        <span className={status === "concluida" ? "text-brand-gray-400 line-through" : ""}>{descricao}</span>
      </td>
      <td className="py-2 pr-3 text-brand-gray-600">{mesPlanejado}</td>
      <td className="py-2 pr-3">
        <form ref={statusFormRef} action={onAtualizarStatus}>
          <input type="hidden" name="tarefa_id" value={tarefaId} />
          <input type="hidden" name="etapa_id" value={etapaId} />
          <input type="hidden" name="data_conclusao_real" value={dataConclusaoReal ?? ""} />
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
      </td>
      <td className="py-2 pr-3">
        <form ref={dataFormRef} action={onAtualizarData}>
          <input type="hidden" name="tarefa_id" value={tarefaId} />
          <input type="hidden" name="etapa_id" value={etapaId} />
          <input
            key={dataConclusaoReal ?? "vazio"}
            type="date"
            name="data_conclusao_real"
            defaultValue={dataConclusaoReal ?? ""}
            onChange={() => dataFormRef.current?.requestSubmit()}
            className={`oc-input w-[9.5rem] py-1 text-xs ${atrasada ? "border-status-danger/60 text-status-danger" : ""}`}
          />
        </form>
      </td>
      <td className="py-2">
        <div className="flex items-center justify-between gap-2">
          {situacao}
          <div className="flex shrink-0 items-center gap-2">
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
      </td>
    </tr>
  );
}
