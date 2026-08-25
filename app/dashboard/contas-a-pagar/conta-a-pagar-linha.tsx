"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/conversation/format";
import { formatDataBrasil } from "@/lib/format-date";
import { AppModal } from "../app-modal";
import { SubmitButton } from "../submit-button";
import { marcarContaAPagarComoPagaAction, cancelarContaAPagarAction, excluirContaAPagarAction } from "./actions";

const RECORRENCIA_LABEL: Record<string, string> = {
  nenhuma: "Única",
  semanal: "Toda semana",
  mensal: "Todo mês",
};

export function ContaAPagarLinha({
  id,
  descricao,
  valor,
  dataVencimento,
  recorrencia,
  status,
  obraNome,
  categoriaNome,
  fornecedorNome,
  temArquivo,
  vencida,
}: {
  id: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  recorrencia: string;
  status: "pendente" | "pago" | "cancelado";
  obraNome: string | null;
  categoriaNome: string | null;
  fornecedorNome: string | null;
  temArquivo: boolean;
  vencida: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-brand-black">
          {descricao}
          {recorrencia !== "nenhuma" && (
            <span className="ml-2 rounded-full bg-brand-gray-100 px-2 py-0.5 text-[10px] font-bold text-brand-gray-600">
              🔁 {RECORRENCIA_LABEL[recorrencia]}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-brand-gray-500">
          {formatBRL(valor)} · vence {formatDataBrasil(dataVencimento)}
          {obraNome ? ` · ${obraNome}` : " · Sem obra (Administrativo)"}
          {categoriaNome ? ` · ${categoriaNome}` : ""}
          {fornecedorNome ? ` · ${fornecedorNome}` : ""}
          {temArquivo ? " · 📎 tem arquivo" : ""}
        </p>
      </div>

      {status === "pendente" && (
        <div className="flex shrink-0 items-center gap-2">
          {vencida && (
            <span className="rounded-full bg-status-danger/15 px-2.5 py-1 text-[11px] font-bold text-status-danger">
              Vencida
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-brand-sm bg-brand-black px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
          >
            Marcar como paga
          </button>
          <form action={cancelarContaAPagarAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="text-xs font-bold text-brand-gray-500 hover:text-brand-red">
              Cancelar
            </button>
          </form>
        </div>
      )}

      {status === "pago" && (
        <span className="shrink-0 rounded-full bg-status-success/15 px-2.5 py-1 text-[11px] font-bold text-status-success">
          Paga
        </span>
      )}

      {status !== "pendente" && (
        <form action={excluirContaAPagarAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="shrink-0 text-xs font-bold text-brand-gray-400 hover:text-brand-red">
            Excluir
          </button>
        </form>
      )}

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Pagamento"
        title={`Marcar "${descricao}" como paga?`}
        description="Isso cria o lançamento de despesa com a data de hoje. Se for uma conta recorrente, a próxima ocorrência já é criada automaticamente."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form id={`pagar-${id}`} action={marcarContaAPagarComoPagaAction}>
              <input type="hidden" name="conta_id" value={id} />
              <SubmitButton className="oc-button oc-button-primary w-full sm:w-auto" pendingText="Salvando...">
                Confirmar pagamento
              </SubmitButton>
            </form>
          </>
        }
      >
        <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
          Comprovante de pagamento (opcional)
          <input
            type="file"
            name="arquivo"
            form={`pagar-${id}`}
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-black file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
          />
        </label>
      </AppModal>
    </li>
  );
}
