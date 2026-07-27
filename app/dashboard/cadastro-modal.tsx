"use client";

import { useState } from "react";
import { AppModal } from "./app-modal";

type CadastroModalProps = {
  titulo: string;
  descricao?: string;
  botao: string;
  icone?: React.ReactNode;
  variante?: "primario" | "secundario" | "icone" | "custom";
  triggerClassName?: string;
  triggerId?: string;
  modalSize?: "default" | "wide";
  children: React.ReactNode;
};

export function CadastroModal({
  titulo,
  descricao,
  botao,
  icone,
  variante = "secundario",
  triggerClassName,
  triggerId,
  modalSize = "default",
  children,
}: CadastroModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={botao}
        title={botao}
        data-modal-trigger-id={triggerId}
        className={
          triggerClassName ??
          (variante === "custom"
            ? "block w-full text-left"
            : variante === "icone"
            ? "inline-flex h-10 w-10 items-center justify-center rounded-brand-sm bg-brand-black text-white shadow-[0_12px_24px_rgba(17,19,23,.14)] hover:bg-brand-red"
            : variante === "primario"
              ? "oc-button oc-button-primary"
              : "oc-button oc-button-dark text-xs")
        }
      >
        {icone ?? botao}
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Cadastro"
        title={titulo}
        description={descricao}
        tone="neutral"
        size={modalSize}
        footer={
          <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
            Fechar
          </button>
        }
      >
        {children}
      </AppModal>
    </>
  );
}
