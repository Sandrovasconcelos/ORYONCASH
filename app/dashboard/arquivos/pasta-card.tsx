"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CamposDeEnvio, DestinoParcial } from "@/lib/arquivos/destino";
import { enviarArquivoParaBiblioteca } from "./enviar-cliente";
import { IconePasta } from "./componentes";
import { moverPorArrasteAction } from "./gerenciador-actions";

export const TIPO_ARRASTE = "application/x-oryon-arquivos";

/** Pasta clicavel que tambem recebe arquivos arrastados (move pra ela). */
export function PastaCard({
  destino,
  nome,
  detalhe,
  total,
  vencidos,
  vencendo,
  grande = false,
  alvo = null,
  envio = null,
}: {
  destino: string;
  nome: string;
  detalhe?: string;
  total: number;
  vencidos: number;
  vencendo: number;
  grande?: boolean;
  /** Pra onde mover o que for solto aqui; null = so navegacao. */
  alvo?: DestinoParcial | null;
  /** Campos de envio: arquivos do computador soltos aqui sao guardados nesta pasta. */
  envio?: CamposDeEnvio | null;
}) {
  const router = useRouter();
  const [sobre, setSobre] = useState(false);
  const [doComputador, setDoComputador] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function enviarDoComputador(arquivos: File[]) {
    if (!envio) return;
    startTransition(async () => {
      let ok = 0;
      for (let i = 0; i < arquivos.length; i++) {
        setAviso(`Enviando ${i + 1} de ${arquivos.length}…`);
        const r = await enviarArquivoParaBiblioteca(arquivos[i], envio);
        if (!("erro" in r)) ok += 1;
      }
      setAviso(ok === arquivos.length ? `${ok} guardado${ok > 1 ? "s" : ""}` : `${ok} de ${arquivos.length} guardados`);
      router.refresh();
      setTimeout(() => setAviso(null), 3500);
    });
  }

  function aoSoltar(e: React.DragEvent) {
    setSobre(false);
    // Arquivos do computador soltos na pasta: sobe pra ela.
    if (envio && e.dataTransfer.files.length > 0 && !e.dataTransfer.types.includes(TIPO_ARRASTE)) {
      e.preventDefault();
      e.stopPropagation();
      enviarDoComputador([...e.dataTransfer.files]);
      return;
    }
    if (!alvo) return;
    const bruto = e.dataTransfer.getData(TIPO_ARRASTE);
    if (!bruto) return;
    e.preventDefault();
    let ids: string[] = [];
    try {
      ids = JSON.parse(bruto) as string[];
    } catch {
      return;
    }
    startTransition(async () => {
      const { movidos } = await moverPorArrasteAction(ids, alvo);
      setAviso(movidos > 0 ? `${movidos} movido${movidos > 1 ? "s" : ""}` : "Já estava aqui");
      router.refresh();
      setTimeout(() => setAviso(null), 2500);
    });
  }

  return (
    <Link
      href={destino}
      onDragOver={(e) => {
        if ((alvo && e.dataTransfer.types.includes(TIPO_ARRASTE)) || (envio && e.dataTransfer.types.includes("Files"))) {
          e.preventDefault();
          setSobre(true);
          setDoComputador(e.dataTransfer.types.includes("Files") && !e.dataTransfer.types.includes(TIPO_ARRASTE));
        }
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={aoSoltar}
      className={`group flex flex-col gap-2 rounded-card border bg-white p-3 shadow-card transition sm:p-4 ${
        sobre ? "border-brand-red bg-brand-red/5 ring-2 ring-brand-red/30" : "border-brand-gray-300/60 hover:border-brand-red/40 hover:shadow-brand-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <IconePasta cheia={total > 0} grande={grande} />
        {(vencidos > 0 || vencendo > 0) && (
          <span
            className={`rounded-brand-sm px-2 py-0.5 text-[11px] font-bold ${vencidos > 0 ? "bg-status-danger/10 text-status-danger" : "bg-status-warning/10 text-status-warning"}`}
            title={`${vencidos} vencido(s), ${vencendo} vencendo`}
          >
            {vencidos > 0 ? `${vencidos} vencido${vencidos > 1 ? "s" : ""}` : `${vencendo} vencendo`}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-brand-black group-hover:text-brand-red">{nome}</p>
        {detalhe && <p className="mt-0.5 text-xs text-brand-gray-500">{detalhe}</p>}
        <p className="mt-0.5 text-xs text-brand-gray-500">{aviso ?? (sobre ? (doComputador ? "Solte para guardar aqui" : "Solte para mover aqui") : total === 0 ? "Vazia" : `${total} arquivo${total === 1 ? "" : "s"}`)}</p>
      </div>
    </Link>
  );
}
