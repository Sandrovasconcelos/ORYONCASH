"use client";

import { useState } from "react";
import { ActionIcon } from "../action-icon";
import { AppModal } from "../app-modal";

type NumeroActionButtonProps = {
  telefone: string;
  ativo?: boolean;
  tipo: "toggle" | "delete";
  action: (formData: FormData) => void | Promise<void>;
};

export function NumeroActionButton({
  telefone,
  ativo,
  tipo,
  action,
}: NumeroActionButtonProps) {
  const [open, setOpen] = useState(false);
  const isDelete = tipo === "delete";
  const label = isDelete ? "Remover" : ativo ? "Desativar" : "Ativar";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={
          isDelete
            ? "inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-red/30 bg-white text-brand-red hover:bg-brand-red hover:text-white"
            : "inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-gray-300 bg-white text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
        }
      >
        <ActionIcon name={isDelete ? "user-x" : "power"} />
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={isDelete ? "Confirmação" : "Acesso WhatsApp"}
        title={isDelete ? "Remover número autorizado?" : ativo ? "Desativar acesso?" : "Ativar acesso?"}
        description={
          isDelete
            ? `O número ${telefone} não poderá mais registrar informações pelo WhatsApp.`
            : ativo
              ? `O número ${telefone} ficará bloqueado para novos lançamentos.`
              : `O número ${telefone} poderá voltar a registrar informações pelo WhatsApp.`
        }
        tone={isDelete ? "danger" : "neutral"}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form action={action}>
              <input type="hidden" name="telefone" value={telefone} />
              {!isDelete && <input type="hidden" name="ativo" value={String(ativo)} />}
              <button
                type="submit"
                className={isDelete ? "oc-button oc-button-primary" : "oc-button oc-button-dark"}
              >
                {isDelete ? "Sim, remover" : ativo ? "Sim, desativar" : "Sim, ativar"}
              </button>
            </form>
          </>
        }
      />
    </>
  );
}
