"use client";

import { useState } from "react";
import { ActionIcon } from "../action-icon";
import { AppModal } from "../app-modal";
import { SubmitButton } from "../submit-button";
import { excluirArquivoAction } from "./actions";

export function ExcluirArquivoButton({ id, nome }: { id: string; nome: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Excluir arquivo"
        title="Excluir arquivo"
        className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-red/30 bg-white text-brand-red hover:bg-brand-red hover:text-white"
      >
        <ActionIcon name="trash" />
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Arquivos"
        title="Excluir arquivo?"
        description={
          <>
            <span className="font-semibold text-brand-black">{nome}</span> será apagado de vez. Essa ação não pode ser
            desfeita.
          </>
        }
        tone="danger"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form action={excluirArquivoAction}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton pendingText="Excluindo..." className="oc-button oc-button-primary w-full sm:w-auto">
                Excluir
              </SubmitButton>
            </form>
          </>
        }
      />
    </>
  );
}
