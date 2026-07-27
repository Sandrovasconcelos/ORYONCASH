"use client";

import { useState } from "react";
import { ActionIcon } from "../action-icon";
import { AppModal } from "../app-modal";

export function DeleteButton({
  despesaId,
  action,
}: {
  despesaId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enviar lançamento para a lixeira"
        title="Enviar lançamento para a lixeira"
        className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-red/30 bg-white text-brand-red hover:bg-brand-red hover:text-white"
      >
        <ActionIcon name="trash" />
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Lixeira"
        title="Enviar lançamento para a lixeira?"
        description="A despesa sairá da tabela, dos totais e dos relatórios, mas poderá ser restaurada depois pela aba Lixeira."
        tone="danger"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form action={action}>
              <input type="hidden" name="id" value={despesaId} />
              <button type="submit" className="oc-button oc-button-primary w-full sm:w-auto">
                Enviar para lixeira
              </button>
            </form>
          </>
        }
      >
        <div className="rounded-brand-sm border border-brand-gray-300/70 bg-brand-gray-100 p-4 text-sm leading-6 text-brand-gray-700">
          Os comprovantes vinculados continuam preservados junto do lançamento. Se restaurar
          depois, eles voltam a aparecer no dashboard.
        </div>
      </AppModal>
    </>
  );
}
