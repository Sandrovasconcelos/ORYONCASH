"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppModal } from "../app-modal";
import { SubmitButton } from "../submit-button";
import type { AreaArquivo } from "@/lib/arquivos/tipos";
import { BadgeValidade, rotuloDoFormato } from "./componentes";
import { CamposDeLocal } from "./campos-de-local";
import { CLASSE_CAMPO, CLASSE_ROTULO } from "./estilos";
import { TIPO_ARRASTE } from "./pasta-card";
import { copiarArquivosAction, excluirVariosAction, moverArquivosAction, renomearArquivoAction } from "./gerenciador-actions";

export type ItemDaLista = {
  id: string;
  nome: string;
  mime_type: string | null;
  nome_arquivo: string | null;
  /** Texto pronto, ex: "Arquivado em 13/10/2026 às 17:56 · 56 KB". */
  meta: string;
  descricao: string | null;
  /** "Obras › Aurora › Licenças" (so quando a lista mistura pastas, como na busca). */
  caminho: string | null;
  validade: string | null;
  avisar: number;
  abreNoNavegador: boolean;
};

type Modal = "mover" | "copiar" | "excluir" | "renomear" | null;

type Contexto = { area: AreaArquivo; obraId: string; pasta: string; tipo: string };

export function ListaDeArquivos({
  itens,
  acoesPorId,
  hoje,
  obras,
  sugestoesDePasta,
  contexto,
}: {
  itens: ItemDaLista[];
  /** Botoes de cada arquivo (baixar, editar, excluir), montados no servidor. */
  acoesPorId: Record<string, React.ReactNode>;
  hoje: string;
  obras: { id: string; nome: string }[];
  sugestoesDePasta: string[];
  contexto: Contexto;
}) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal>(null);
  const [novoNome, setNovoNome] = useState("");
  const [, startTransition] = useTransition();

  const ids = [...selecionados];
  const todos = itens.length > 0 && selecionados.size === itens.length;

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function fechar() {
    setModal(null);
    setSelecionados(new Set());
    router.refresh();
  }

  function iniciarArraste(e: React.DragEvent, id: string) {
    const arrastados = selecionados.has(id) ? ids : [id];
    e.dataTransfer.setData(TIPO_ARRASTE, JSON.stringify(arrastados));
    e.dataTransfer.effectAllowed = "move";
  }

  const unico = ids.length === 1 ? itens.find((i) => i.id === ids[0]) : undefined;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-brand-gray-300/60 bg-brand-gray-100/60 px-3 py-2 text-xs font-semibold text-brand-gray-600 sm:px-5">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={todos}
            onChange={() => setSelecionados(todos ? new Set() : new Set(itens.map((i) => i.id)))}
            className="h-5 w-5 accent-brand-red sm:h-4 sm:w-4"
          />
          {selecionados.size > 0 ? `${selecionados.size} selecionado${selecionados.size > 1 ? "s" : ""}` : "Selecionar todos"}
        </label>
        <span className="ml-auto hidden text-brand-gray-500 sm:inline">Arraste para uma pasta para mover</span>
      </div>

      <ul className="divide-y divide-brand-gray-300/60">
        {itens.map((l) => {
          const marcado = selecionados.has(l.id);
          return (
            <li
              key={l.id}
              draggable
              onDragStart={(e) => iniciarArraste(e, l.id)}
              className={`flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5 ${marcado ? "bg-brand-red/5" : ""}`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(l.id)}
                  aria-label={`Selecionar ${l.nome}`}
                  className="mt-2.5 h-5 w-5 shrink-0 accent-brand-red sm:mt-3 sm:h-4 sm:w-4"
                />
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-sm bg-brand-gray-100 text-[11px] font-black text-brand-gray-700">
                  {rotuloDoFormato(l.mime_type, l.nome_arquivo)}
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={`/dashboard/arquivos/${l.id}${l.abreNoNavegador ? "" : "?baixar=1"}`}
                    target="_blank"
                    rel="noreferrer"
                    draggable={false}
                    className="line-clamp-2 break-words text-sm font-bold text-brand-black hover:text-brand-red hover:underline"
                  >
                    {l.nome}
                  </a>
                  <p className="line-clamp-2 break-words text-xs text-brand-gray-500">
                    {l.caminho ? `${l.caminho} · ` : ""}
                    {l.meta}
                    {l.descricao ? ` · ${l.descricao}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pl-8 sm:justify-end sm:pl-0">
                <BadgeValidade validade={l.validade} avisar={l.avisar} hoje={hoje} />
                <div className="flex items-center gap-2">{acoesPorId[l.id]}</div>
              </div>
            </li>
          );
        })}
      </ul>

      {selecionados.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:rounded-card sm:border sm:px-4">
          <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2">
            <span className="mr-1 w-full text-center text-xs font-bold text-brand-gray-600 sm:w-auto">
              {selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}
            </span>
            <button type="button" onClick={() => setModal("mover")} className="oc-button oc-button-dark text-xs">
              Mover
            </button>
            <button type="button" onClick={() => setModal("copiar")} className="oc-button oc-button-dark text-xs">
              Copiar
            </button>
            {unico && (
              <button
                type="button"
                onClick={() => {
                  setNovoNome(unico.nome);
                  setModal("renomear");
                }}
                className="oc-button oc-button-soft text-xs"
              >
                Renomear
              </button>
            )}
            <button type="button" onClick={() => setModal("excluir")} className="oc-button oc-button-soft text-xs text-brand-red">
              Excluir
            </button>
            <button type="button" onClick={() => setSelecionados(new Set())} className="oc-button oc-button-soft text-xs">
              Limpar
            </button>
          </div>
        </div>
      )}

      {(modal === "mover" || modal === "copiar") && (
        <AppModal
          open
          onClose={() => setModal(null)}
          eyebrow={modal === "mover" ? "Mover arquivos" : "Copiar arquivos"}
          title={`${selecionados.size} arquivo${selecionados.size > 1 ? "s" : ""}`}
          description={
            modal === "mover"
              ? "Escolha para onde eles vão. No Google Drive, a pasta também muda."
              : "Cria uma cópia em cada arquivo no destino. Se for pro mesmo lugar, a cópia ganha “(cópia)” no nome."
          }
          footer={
            <button type="button" onClick={() => setModal(null)} className="oc-button oc-button-soft">
              Cancelar
            </button>
          }
        >
          <form
            action={async (formData) => {
              await (modal === "mover" ? moverArquivosAction : copiarArquivosAction)(formData);
              fechar();
            }}
            className="flex flex-col gap-4 text-left"
          >
            <input type="hidden" name="ids" value={ids.join(",")} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CamposDeLocal
                obras={obras}
                areaInicial={contexto.area}
                obraIdInicial={contexto.obraId}
                pastaInicial={contexto.pasta}
                tipoInicial={contexto.tipo}
                sugestoesDePasta={sugestoesDePasta}
              />
            </div>
            <p className="text-xs text-brand-gray-500">Deixe o tipo vazio para manter o de cada arquivo. Digite um nome novo de pasta ou tipo para criar.</p>
            <SubmitButton className="oc-button oc-button-primary self-start" pendingText={modal === "mover" ? "Movendo..." : "Copiando..."}>
              {modal === "mover" ? "Mover" : "Copiar"}
            </SubmitButton>
          </form>
        </AppModal>
      )}

      {modal === "excluir" && (
        <AppModal
          open
          onClose={() => setModal(null)}
          eyebrow="Confirmar"
          title={`Excluir ${selecionados.size} arquivo${selecionados.size > 1 ? "s" : ""}?`}
          description="Os arquivos saem da biblioteca. No Google Drive, vão para a lixeira do Drive (dá para recuperar por 30 dias)."
          tone="danger"
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} className="oc-button oc-button-soft">
                Cancelar
              </button>
              <form
                action={async (formData) => {
                  await excluirVariosAction(formData);
                  fechar();
                }}
              >
                <input type="hidden" name="ids" value={ids.join(",")} />
                <SubmitButton pendingText="Excluindo..." className="oc-button oc-button-primary w-full sm:w-auto">
                  Excluir
                </SubmitButton>
              </form>
            </>
          }
        />
      )}

      {modal === "renomear" && unico && (
        <AppModal
          open
          onClose={() => setModal(null)}
          eyebrow="Renomear"
          title={unico.nome}
          footer={
            <button type="button" onClick={() => setModal(null)} className="oc-button oc-button-soft">
              Cancelar
            </button>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                await renomearArquivoAction(unico.id, novoNome);
                fechar();
              });
            }}
            className="flex flex-col gap-4 text-left"
          >
            <label className={CLASSE_ROTULO}>
              Novo nome
              <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required autoFocus className={CLASSE_CAMPO} />
            </label>
            <button type="submit" className="oc-button oc-button-primary self-start">
              Salvar nome
            </button>
          </form>
        </AppModal>
      )}
    </>
  );
}
