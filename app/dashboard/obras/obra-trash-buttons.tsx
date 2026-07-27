"use client";

import { useState } from "react";
import { ActionIcon } from "../action-icon";
import { AppModal } from "../app-modal";

type Action = (formData: FormData) => void | Promise<void>;

function TrashDialog({
  buttonLabel,
  buttonIcon,
  title,
  eyebrow,
  description,
  confirmLabel,
  helper,
  id,
  action,
  danger = false,
  withReason = false,
}: {
  buttonLabel: string;
  buttonIcon: React.ReactNode;
  title: string;
  eyebrow: string;
  description: string;
  confirmLabel: string;
  helper: string;
  id: string;
  action: Action;
  danger?: boolean;
  withReason?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formId = `obra-trash-${id}-${confirmLabel.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={buttonLabel}
        title={buttonLabel}
        className={
          danger
            ? "inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-red/30 bg-white text-brand-red hover:bg-brand-red hover:text-white"
            : "inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-gray-300 bg-white text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
        }
      >
        {buttonIcon}
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={eyebrow}
        title={title}
        description={description}
        tone={danger ? "danger" : "success"}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form id={formId} action={action}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className={danger ? "oc-button oc-button-primary" : "oc-button oc-button-dark"}
              >
                {confirmLabel}
              </button>
            </form>
          </>
        }
      >
        {withReason && (
          <label className="mb-4 flex flex-col gap-1 text-sm font-semibold text-brand-gray-700">
            Motivo, opcional
            <textarea
              form={formId}
              name="motivo"
              rows={3}
              placeholder="Ex: obra cadastrada em duplicidade"
              className="oc-input min-h-24 w-full font-normal"
            />
          </label>
        )}
        <div
          className={
            danger
              ? "rounded-brand-sm border border-brand-red/20 bg-brand-red/5 p-4 text-sm leading-6 text-brand-gray-700"
              : "rounded-brand-sm border border-status-success/20 bg-[#e9f8f0] p-4 text-sm leading-6 text-brand-gray-700"
          }
        >
          {helper}
        </div>
      </AppModal>
    </>
  );
}

export function MoveObraToTrashButton({ id, action }: { id: string; action: Action }) {
  return (
    <TrashDialog
      id={id}
      action={action}
      buttonLabel="Enviar obra para a lixeira"
      buttonIcon={<ActionIcon name="trash" />}
      eyebrow="Lixeira"
      title="Enviar obra para a lixeira?"
      description="A obra sairá das telas principais, mas poderá ser restaurada depois pela aba Lixeira."
      helper="Os lançamentos, etapas e comprovantes vinculados continuam preservados. A obra só deixa de aparecer nas telas principais e nas opções do WhatsApp."
      confirmLabel="Enviar para lixeira"
      danger
      withReason
    />
  );
}

export function RestoreObraButton({ id, action }: { id: string; action: Action }) {
  return (
    <TrashDialog
      id={id}
      action={action}
      buttonLabel="Restaurar obra"
      buttonIcon={<ActionIcon name="restore" />}
      eyebrow="Lixeira"
      title="Restaurar obra?"
      description="A obra voltará para a lista principal e poderá receber lançamentos novamente."
      helper="Depois de restaurada, a obra volta para o dashboard, relatórios, filtros e fluxo do WhatsApp."
      confirmLabel="Restaurar"
    />
  );
}

export function PermanentlyDeleteObraButton({ id, action }: { id: string; action: Action }) {
  return (
    <TrashDialog
      id={id}
      action={action}
      buttonLabel="Apagar obra definitivamente"
      buttonIcon={<ActionIcon name="trash" />}
      eyebrow="Ação definitiva"
      title="Apagar definitivamente?"
      description="Essa ação remove a obra do banco de dados e não poderá ser revertida pela lixeira."
      helper="Use apenas quando tiver certeza de que não precisa mais recuperar essa obra nem seus vínculos."
      confirmLabel="Apagar definitivamente"
      danger
    />
  );
}
