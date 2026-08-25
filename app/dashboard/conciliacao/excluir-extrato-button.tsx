"use client";

import { useState } from "react";
import { excluirExtratoAction } from "./actions";
import { ActionIcon } from "../action-icon";
import { AppModal } from "../app-modal";
import { SubmitButton } from "../submit-button";

export function ExcluirExtratoButton({ id, nome }: { id: string; nome: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir extrato ${nome}`}
        title={`Excluir extrato ${nome}`}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-sm border border-brand-red/30 bg-white text-brand-red hover:bg-brand-red hover:text-white"
      >
        <ActionIcon name="trash" />
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Ação definitiva"
        title="Excluir este extrato?"
        description={
          <>
            <span className="font-semibold text-brand-black">{nome}</span> e todas as transações
            lidas dele serão removidos. Os lançamentos que já foram criados a partir daqui
            continuam existindo normalmente.
          </>
        }
        tone="danger"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form action={excluirExtratoAction}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton className="oc-button oc-button-primary w-full sm:w-auto">
                Excluir extrato
              </SubmitButton>
            </form>
          </>
        }
      >
        <div className="rounded-brand-sm border border-brand-red/20 bg-brand-red/5 p-4 text-sm text-brand-gray-700">
          Isso não afeta nenhuma despesa já lançada — só apaga o registro do extrato em si.
        </div>
      </AppModal>
    </>
  );
}
