"use client";

import { useState } from "react";
import { ActionIcon } from "./action-icon";
import { AppModal } from "./app-modal";
import { SubmitButton } from "./submit-button";

/** Botao de lixeira que pede confirmacao antes de apagar de vez (sem lixeira do sistema). */
export function ExcluirComConfirmacao({
  id,
  titulo,
  descricao,
  action,
  rotulo = "Excluir",
  compacto = false,
}: {
  id: string;
  titulo: string;
  descricao: React.ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  rotulo?: string;
  compacto?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={rotulo}
        title={rotulo}
        className={`inline-flex items-center justify-center rounded-brand-sm border border-brand-red/30 bg-white text-brand-red hover:bg-brand-red hover:text-white ${
          compacto ? "h-8 w-8" : "h-10 w-10"
        }`}
      >
        <ActionIcon name="trash" />
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Confirmar"
        title={titulo}
        description={descricao}
        tone="danger"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton pendingText="Excluindo..." className="oc-button oc-button-primary w-full sm:w-auto">
                {rotulo}
              </SubmitButton>
            </form>
          </>
        }
      />
    </>
  );
}
