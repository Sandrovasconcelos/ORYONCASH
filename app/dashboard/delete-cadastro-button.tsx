"use client";

import { useState } from "react";
import { ActionIcon } from "./action-icon";
import { AppModal } from "./app-modal";

type DeleteCadastroButtonProps = {
  id: string;
  nome: string;
  entidade: string;
  usadoEm: number;
  detalhesUso?: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function DeleteCadastroButton({
  id,
  nome,
  entidade,
  usadoEm,
  detalhesUso,
  action,
}: DeleteCadastroButtonProps) {
  const [open, setOpen] = useState(false);
  const possuiVinculos = usadoEm > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enviar ${entidade} para a lixeira`}
        title={`Enviar ${entidade} para a lixeira`}
        className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-red/30 bg-white text-brand-red hover:bg-brand-red hover:text-white"
      >
        <ActionIcon name="trash" />
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Lixeira"
        title={`Enviar ${entidade.toLowerCase()} para a lixeira?`}
        description={
          <>
            <span className="font-semibold text-brand-black">{nome}</span> sairá das telas
            principais e das opções do WhatsApp, mas poderá ser restaurado depois pela aba
            Lixeira.
          </>
        }
        tone={possuiVinculos ? "warning" : "danger"}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
              Cancelar
            </button>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="oc-button oc-button-primary w-full sm:w-auto">
                Enviar para lixeira
              </button>
            </form>
          </>
        }
      >
        <div className="rounded-brand-sm border border-brand-gray-300/70 bg-brand-gray-100 p-4 text-sm text-brand-gray-700">
          {possuiVinculos
            ? `${detalhesUso ?? `Existe vínculo com ${usadoEm} registro(s).`} Os lançamentos antigos continuam preservados; o item só deixa de aparecer para novos cadastros.`
            : "Esse item ficará recuperável na lixeira. Use apagar definitivamente apenas dentro da lixeira."}
        </div>
      </AppModal>
    </>
  );
}
