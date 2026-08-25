"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/conversation/format";
import { AppModal } from "../../app-modal";
import { SubmitButton } from "../../submit-button";
import { vincularTransacaoAction, ignorarTransacaoAction, criarDespesaDaTransacaoAction } from "../actions";

type DespesaCandidata = {
  id: string;
  descricao: string | null;
  valor: number;
  data: string;
  obras?: { nome: string } | null;
  categorias?: { nome: string } | null;
};

function valorInputBR(valor: number) {
  return Number(valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function RevisaoTransacaoModal({
  transacaoId,
  extratoId,
  contaBancariaId,
  transacaoValor,
  transacaoData,
  transacaoDescricao,
  despesasCandidatas,
  obras,
  categorias,
}: {
  transacaoId: string;
  extratoId: string;
  contaBancariaId: string | null;
  transacaoValor: number;
  transacaoData: string;
  transacaoDescricao: string | null;
  despesasCandidatas: DespesaCandidata[];
  obras: { id: string; nome: string }[];
  categorias: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<"vincular" | "criar">(despesasCandidatas.length > 0 ? "vincular" : "criar");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-brand-sm bg-brand-black px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
      >
        Revisar
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Transação sem lançamento"
        title={`${formatBRL(transacaoValor)} em ${transacaoData.split("-").reverse().join("/")}`}
        description={transacaoDescricao || "Sem descrição no extrato"}
        footer={
          <form action={ignorarTransacaoAction}>
            <input type="hidden" name="transacao_id" value={transacaoId} />
            <input type="hidden" name="extrato_id" value={extratoId} />
            <SubmitButton className="oc-button oc-button-soft w-full sm:w-auto" pendingText="Ignorando...">
              Ignorar (não é despesa de obra)
            </SubmitButton>
          </form>
        }
      >
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setAba("vincular")}
            className={`rounded-brand-sm px-3 py-1.5 text-xs font-bold ${
              aba === "vincular" ? "bg-brand-black text-white" : "bg-brand-gray-100 text-brand-gray-600"
            }`}
          >
            Vincular a lançamento existente
          </button>
          <button
            type="button"
            onClick={() => setAba("criar")}
            className={`rounded-brand-sm px-3 py-1.5 text-xs font-bold ${
              aba === "criar" ? "bg-brand-black text-white" : "bg-brand-gray-100 text-brand-gray-600"
            }`}
          >
            Criar novo lançamento
          </button>
        </div>

        {aba === "vincular" ? (
          despesasCandidatas.length === 0 ? (
            <p className="text-sm text-brand-gray-500">
              Nenhum lançamento dessa conta está livre pra vincular. Crie um novo lançamento na
              outra aba.
            </p>
          ) : (
            <form action={vincularTransacaoAction} className="flex flex-col gap-3">
              <input type="hidden" name="transacao_id" value={transacaoId} />
              <input type="hidden" name="extrato_id" value={extratoId} />
              <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
                Lançamento
                <select
                  name="despesa_id"
                  required
                  className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
                >
                  <option value="">Selecione…</option>
                  {despesasCandidatas.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.data.split("-").reverse().join("/")} · {formatBRL(d.valor)} ·{" "}
                      {d.obras?.nome ?? "—"} · {d.categorias?.nome ?? "—"}
                      {d.descricao ? ` · ${d.descricao}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton
                className="self-start rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-extrabold text-white"
                pendingText="Vinculando..."
              >
                Vincular
              </SubmitButton>
            </form>
          )
        ) : (
          <form action={criarDespesaDaTransacaoAction} className="flex flex-col gap-3">
            <input type="hidden" name="transacao_id" value={transacaoId} />
            <input type="hidden" name="extrato_id" value={extratoId} />
            <input type="hidden" name="conta_bancaria_id" value={contaBancariaId ?? ""} />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
                Obra
                <select
                  name="obra_id"
                  required
                  className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
                >
                  <option value="">Selecione…</option>
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
                Categoria
                <select
                  name="categoria_id"
                  required
                  className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
                >
                  <option value="">Selecione…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
                Valor
                <input
                  name="valor"
                  defaultValue={valorInputBR(transacaoValor)}
                  required
                  className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
                Data
                <input
                  type="date"
                  name="data"
                  defaultValue={transacaoData}
                  required
                  className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
              Descrição
              <input
                name="descricao"
                defaultValue={transacaoDescricao ?? ""}
                className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
              />
            </label>
            <SubmitButton
              className="self-start rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-extrabold text-white"
              pendingText="Criando..."
            >
              Criar lançamento e vincular
            </SubmitButton>
          </form>
        )}
      </AppModal>
    </>
  );
}
