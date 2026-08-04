"use client";

import { atualizarStatusAtividadeAction } from "../actions";

export function AtividadeStatusSelect({
  atividadeId,
  status,
}: {
  atividadeId: string;
  status: string;
}) {
  return (
    <form action={atualizarStatusAtividadeAction}>
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <select
        name="status"
        defaultValue={status}
        className="oc-input py-1.5 text-xs"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="a_fazer">A fazer</option>
        <option value="em_andamento">Em andamento</option>
        <option value="concluida">Concluída</option>
      </select>
    </form>
  );
}
