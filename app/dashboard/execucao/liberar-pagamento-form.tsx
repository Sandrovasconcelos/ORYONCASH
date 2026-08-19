"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/conversation/format";
import { liberarPagamentoEtapaAction } from "../actions";
import { SubmitButton } from "../submit-button";

export function LiberarPagamentoForm({
  etapaId,
  percentual,
  valor,
  fornecedorNome,
  categorias,
  categoriaPadraoId,
}: {
  etapaId: string;
  percentual: number;
  valor: number;
  fornecedorNome: string;
  categorias: { id: string; nome: string }[];
  categoriaPadraoId: string | null;
}) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="oc-button oc-button-primary"
      >
        Liberar pagamento — {formatBRL(valor)}
      </button>
    );
  }

  return (
    <form
      action={liberarPagamentoEtapaAction}
      className="flex flex-col gap-3 rounded-brand-sm border border-brand-red/30 bg-brand-red/5 p-4"
    >
      <input type="hidden" name="etapa_id" value={etapaId} />
      <p className="text-sm font-semibold text-brand-black">Confirmar liberação</p>
      <dl className="grid grid-cols-2 gap-2 text-xs text-brand-gray-700">
        <dt className="font-bold">Percentual</dt>
        <dd>{percentual}%</dd>
        <dt className="font-bold">Valor</dt>
        <dd className="font-extrabold text-brand-black">{formatBRL(valor)}</dd>
        <dt className="font-bold">Fornecedor</dt>
        <dd>{fornecedorNome}</dd>
      </dl>
      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Categoria (usada na despesa gerada)
        <select name="categoria_id" required defaultValue={categoriaPadraoId ?? ""} className="oc-input">
          <option value="">Selecione</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <SubmitButton className="oc-button oc-button-primary">Confirmar liberação</SubmitButton>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="oc-button oc-button-soft"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
