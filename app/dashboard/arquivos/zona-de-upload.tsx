"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { enviarArquivoParaBiblioteca } from "./enviar-cliente";
import type { CamposDeEnvio } from "@/lib/arquivos/destino";

type Progresso = { nome: string; estado: "enviando" | "ok" | "erro"; mensagem?: string };

/**
 * Deixa soltar arquivos do computador em cima da tela: eles vao pra pasta que
 * esta aberta. So no computador (no celular o envio e pelo botao "+ Novo arquivo").
 */
export function ZonaDeUpload({
  ativo,
  destino,
  rotuloDoDestino,
  children,
}: {
  ativo: boolean;
  destino: CamposDeEnvio;
  rotuloDoDestino: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [arrastando, setArrastando] = useState(false);
  const [fila, setFila] = useState<Progresso[]>([]);
  const contador = useRef(0);

  const comArquivos = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

  async function enviar(arquivos: File[]) {
    setFila(arquivos.map((f) => ({ nome: f.name, estado: "enviando" })));
    for (let i = 0; i < arquivos.length; i++) {
      const r = await enviarArquivoParaBiblioteca(arquivos[i], destino);
      setFila((atual) => atual.map((p, j) => (j === i ? { ...p, estado: "erro" in r ? "erro" : "ok", mensagem: "erro" in r ? r.erro : undefined } : p)));
    }
    router.refresh();
    setTimeout(() => setFila([]), 6000);
  }

  return (
    <div
      className="relative"
      onDragEnter={(e) => {
        if (!comArquivos(e)) return;
        e.preventDefault();
        contador.current += 1;
        setArrastando(true);
      }}
      onDragOver={(e) => {
        if (comArquivos(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!comArquivos(e)) return;
        contador.current = Math.max(0, contador.current - 1);
        if (contador.current === 0) setArrastando(false);
      }}
      onDrop={(e) => {
        if (!comArquivos(e)) return;
        e.preventDefault();
        contador.current = 0;
        setArrastando(false);
        const arquivos = [...e.dataTransfer.files];
        if (ativo && arquivos.length > 0) void enviar(arquivos);
      }}
    >
      {children}

      {arrastando && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
          <div className="rounded-card border-2 border-dashed border-white bg-brand-black/90 px-8 py-6 text-center text-white shadow-brand-md">
            <p className="text-base font-black">{ativo ? "Solte para guardar" : "Solte em cima de uma pasta"}</p>
            {ativo && <p className="mt-1 text-sm text-white/80">{rotuloDoDestino}</p>}
          </div>
        </div>
      )}

      {fila.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-72 rounded-card border border-black/10 bg-white p-3 text-sm shadow-brand-md">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-gray-500">Enviando arquivos</p>
          <ul className="flex flex-col gap-1">
            {fila.map((p, i) => (
              <li key={`${p.nome}-${i}`} className="flex items-start justify-between gap-2">
                <span className="truncate text-brand-black">{p.nome}</span>
                <span className={`shrink-0 text-xs font-bold ${p.estado === "ok" ? "text-status-success" : p.estado === "erro" ? "text-status-danger" : "text-brand-gray-500"}`}>
                  {p.estado === "ok" ? "guardado" : p.estado === "erro" ? (p.mensagem ?? "erro") : "enviando…"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
