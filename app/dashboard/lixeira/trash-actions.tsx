"use client";

import { useState } from "react";
import { permanentlyDeleteFromTrashAction, restoreFromTrashAction } from "../actions";
import { ActionIcon } from "../action-icon";
import { AppModal } from "../app-modal";

type TipoLixeira = "obra" | "categoria" | "material" | "fornecedor" | "despesa";

export function RestoreTrashButton({
  id,
  tipo,
  nome,
}: {
  id: string;
  tipo: TipoLixeira;
  nome: string;
}) {
  return (
    <form action={restoreFromTrashAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tipo" value={tipo} />
      <button
        type="submit"
        aria-label={`Restaurar ${nome}`}
        title={`Restaurar ${nome}`}
        className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-status-success/25 bg-[#e9f8f0] text-status-success hover:bg-status-success hover:text-white"
      >
        <ActionIcon name="restore" />
      </button>
    </form>
  );
}

export function PermanentDeleteTrashButton({
  id,
  tipo,
  nome,
}: {
  id: string;
  tipo: TipoLixeira;
  nome: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Apagar definitivamente ${nome}`}
        title={`Apagar definitivamente ${nome}`}
        className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-red/30 bg-white text-brand-red hover:bg-brand-red hover:text-white"
      >
        <ActionIcon name="trash" />
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Ação definitiva"
        title="Apagar definitivamente?"
        description={
          <>
            <span className="font-semibold text-brand-black">{nome}</span> será removido do banco
            e não poderá ser restaurado pela lixeira.
          </>
        }
        tone="danger"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form action={permanentlyDeleteFromTrashAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="tipo" value={tipo} />
              <button type="submit" className="oc-button oc-button-primary w-full sm:w-auto">
                Apagar definitivamente
              </button>
            </form>
          </>
        }
      >
        <div className="rounded-brand-sm border border-brand-red/20 bg-brand-red/5 p-4 text-sm text-brand-gray-700">
          Use essa opção apenas quando tiver certeza de que não precisa mais recuperar o item.
          Para voltar ao app, use o botão restaurar.
        </div>
      </AppModal>
    </>
  );
}
