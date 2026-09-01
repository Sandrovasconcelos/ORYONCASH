"use client";

import Link from "next/link";
import { useState } from "react";
import { SubmitButton } from "../submit-button";

type Obra = { id: string; nome: string };
type Etapa = { id: string; nome: string; obra_id: string };
type Categoria = { id: string; nome: string };
type Fornecedor = { id: string; nome: string };

export function ContratoFornecedorForm({
  action,
  obras,
  obraIdPadrao,
  todasEtapas,
  categorias,
  fornecedores,
  contrato,
  onExcluirArquivoAction,
}: {
  action: (formData: FormData) => void | Promise<void>;
  obras: Obra[];
  obraIdPadrao?: string;
  todasEtapas: Etapa[];
  categorias: Categoria[];
  fornecedores: Fornecedor[];
  contrato?: {
    id: string;
    obra_id: string;
    fornecedor_id: string;
    etapa_id: string | null;
    categoria_id: string | null;
    descricao: string | null;
    valor_contrato: number;
    arquivo_url: string | null;
    arquivo_nome: string | null;
  };
  onExcluirArquivoAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [obraId, setObraId] = useState(contrato?.obra_id ?? obraIdPadrao ?? obras[0]?.id ?? "");
  const etapasDaObra = todasEtapas.filter((e) => e.obra_id === obraId);

  return (
    <form action={action} className="flex flex-col gap-4">
      {contrato && <input type="hidden" name="id" value={contrato.id} />}

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Obra
        <select
          name="obra_id"
          required
          value={obraId}
          onChange={(event) => setObraId(event.target.value)}
          className="oc-input"
        >
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Fornecedor
        <select name="fornecedor_id" required defaultValue={contrato?.fornecedor_id ?? ""} className="oc-input">
          <option value="">Selecione</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Etapa (opcional)
        <select
          name="etapa_id"
          className="oc-input"
          defaultValue={contrato?.etapa_id ?? ""}
          key={obraId}
        >
          <option value="">Nenhuma etapa específica (contrato geral)</option>
          {etapasDaObra.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
        {etapasDaObra.length === 0 && (
          <span className="text-xs font-normal text-status-warning">
            Essa obra ainda não tem etapas cadastradas.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Categoria (opcional)
        <select name="categoria_id" className="oc-input" defaultValue={contrato?.categoria_id ?? ""}>
          <option value="">Qualquer categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <span className="text-xs font-normal text-brand-gray-500">
          Com etapa e/ou categoria definidas, conta todo lançamento que bater com qualquer uma das
          duas (o fornecedor do lançamento não importa). Sem nenhuma das duas, soma por fornecedor.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Descrição
        <input
          name="descricao"
          defaultValue={contrato?.descricao ?? ""}
          placeholder="Ex: Mão de obra"
          className="oc-input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Valor do contrato
        <input
          name="valor_contrato"
          defaultValue={contrato ? contrato.valor_contrato.toFixed(2).replace(".", ",") : ""}
          placeholder="0,00"
          required
          className="oc-input"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-brand-gray-700">
        Contrato assinado (PDF ou Word)
        {contrato?.arquivo_url && (
          <div className="flex items-center justify-between gap-2 rounded-brand-sm bg-brand-gray-100 px-3 py-2 text-xs">
            <Link
              href={contrato.arquivo_url}
              target="_blank"
              rel="noreferrer"
              className="truncate font-bold text-status-info hover:underline"
            >
              {contrato.arquivo_nome ?? "Ver arquivo atual"}
            </Link>
            {onExcluirArquivoAction && (
              <button
                type="submit"
                formAction={onExcluirArquivoAction}
                className="shrink-0 text-status-danger hover:underline"
              >
                Remover
              </button>
            )}
          </div>
        )}
        <input
          type="file"
          name="arquivo"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="oc-input"
        />
      </div>

      <SubmitButton className="oc-button oc-button-primary">
        {contrato ? "Salvar edição" : "Salvar contrato"}
      </SubmitButton>
    </form>
  );
}
