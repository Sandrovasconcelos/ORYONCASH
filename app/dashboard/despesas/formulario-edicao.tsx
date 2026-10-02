import Link from "next/link";
import { formatBRL } from "@/lib/conversation/format";
import { rotuloOrigem } from "@/lib/origem";
import { formatDataHoraBrasil } from "@/lib/format-date";
import {
  excluirComprovanteDespesaAction,
  reclassificarComprovanteDespesaAction,
  updateDespesaAction,
} from "../actions";
import { ActionIcon } from "../action-icon";
import { IconeNome } from "../icone-svg";
import { SubmitButton } from "../submit-button";
import { AbasModal } from "./abas-modal";

type Opcao = { id: string; nome: string };

export type ComprovanteEdicao = {
  id: string;
  tipo_documento: string;
  nome_arquivo: string | null;
  conta_origem_banco: string | null;
  conta_origem_titular: string | null;
  metodo_pagamento: string | null;
  numero_documento: string | null;
  url: string | null;
};

export type FormularioEdicaoProps = {
  despesa: {
    id: string;
    obra_id: string | null;
    categoria_id: string;
    etapa_id: string | null;
    material_id: string | null;
    fornecedor_id: string | null;
    conta_bancaria_id: string | null;
    valor: number;
    quantidade: number | null;
    valor_unitario: number | null;
    data: string;
    descricao: string | null;
    origem: string | null;
    criado_por_nome: string | null;
    criado_por_telefone: string | null;
    created_at: string;
  };
  nomes: { obra: string; categoria: string; etapa: string; material: string; fornecedor: string; conta: string };
  obras: Opcao[];
  categorias: Opcao[];
  etapas: Opcao[];
  materiais: Opcao[];
  fornecedores: Opcao[];
  contas: Opcao[];
  comprovantes: ComprovanteEdicao[];
  fornecedorDados: {
    cnpj: string | null;
    cpf: string | null;
    chave_pix: string | null;
    conta_banco: string | null;
    conta_agencia: string | null;
    conta_numero: string | null;
  } | null;
  nota: {
    posicao: number;
    totalItens: number;
    cor: string;
    totalPago: number;
    valorDesconto: number | null;
  } | null;
};

function valorBR(valor: number) {
  return Number(valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CAMPO =
  "w-full rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 sm:text-sm";
const ROTULO = "flex flex-col gap-1.5 text-xs font-bold text-brand-gray-700";
const SECAO = "text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-gray-400";

const TIPOS_DOCUMENTO = [
  {
    tipo: "documento_cobranca",
    titulo: "Conta / nota",
    ajuda: "Nota fiscal, boleto, conta de luz ou cobrança original.",
    icone: "file" as const,
    cor: "text-status-info",
    fundo: "bg-status-info/10",
    borda: "border-status-info/25",
    vazio: "Nenhuma conta ou nota vinculada",
  },
  {
    tipo: "comprovante_pagamento",
    titulo: "Comprovante de pagamento",
    ajuda: "Pix, recibo bancário ou confirmação de pagamento.",
    icone: "payment" as const,
    cor: "text-status-success",
    fundo: "bg-status-success/10",
    borda: "border-status-success/25",
    vazio: "Pagamento ainda sem comprovante",
  },
];

function Selo({ ok, textoOk, textoPendente }: { ok: boolean; textoOk: string; textoPendente: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        ok ? "bg-status-success/10 text-status-success" : "bg-status-warning/10 text-status-warning"
      }`}
    >
      <span aria-hidden="true">{ok ? "✓" : "•"}</span>
      {ok ? textoOk : textoPendente}
    </span>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-brand-sm bg-brand-gray-100/70 px-3 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-gray-400">{rotulo}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-brand-black">{valor}</p>
    </div>
  );
}

export function FormularioEdicao(props: FormularioEdicaoProps) {
  const { despesa: d, nomes, comprovantes, fornecedorDados, nota } = props;
  const temNota = comprovantes.some((c) => c.tipo_documento === "documento_cobranca");
  const temPagamento = comprovantes.some((c) => c.tipo_documento === "comprovante_pagamento");

  const dados = (
    <div className="space-y-5">
      <section>
        <p className={`mb-2 ${SECAO}`}>Valores e data</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={ROTULO}>
            Valor (R$)
            <input
              name="valor"
              inputMode="decimal"
              defaultValue={valorBR(d.valor)}
              required
              className={`${CAMPO} font-display text-lg font-bold sm:text-base`}
            />
          </label>
          <label className={ROTULO}>
            Data
            <input type="date" name="data" defaultValue={d.data} required className={CAMPO} />
          </label>
          <label className={ROTULO}>
            Quantidade
            <input
              name="quantidade"
              inputMode="decimal"
              defaultValue={d.quantidade != null ? valorBR(d.quantidade) : ""}
              placeholder="Ex: 50"
              className={CAMPO}
            />
          </label>
          <label className={ROTULO}>
            Valor unitário
            <input
              name="valor_unitario"
              inputMode="decimal"
              defaultValue={d.valor_unitario != null ? valorBR(d.valor_unitario) : ""}
              placeholder="Ex: 53,00"
              className={CAMPO}
            />
          </label>
        </div>
      </section>

      <section>
        <p className={`mb-2 ${SECAO}`}>Descrição</p>
        <textarea name="descricao" defaultValue={d.descricao ?? ""} rows={2} className={CAMPO} />
      </section>

      <section>
        <p className={`mb-2 ${SECAO}`}>Classificação</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={ROTULO}>
            Obra
            <select name="obra_id" defaultValue={d.obra_id ?? ""} className={CAMPO}>
              <option value="">Sem obra (Administrativo)</option>
              {props.obras.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            Categoria
            <select name="categoria_id" defaultValue={d.categoria_id} required className={CAMPO}>
              {props.categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            Etapa
            <select name="etapa_id" defaultValue={d.etapa_id ?? ""} className={CAMPO}>
              <option value="">Sem etapa</option>
              {props.etapas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            Material
            <select name="material_id" defaultValue={d.material_id ?? ""} className={CAMPO}>
              <option value="">Sem material</option>
              {props.materiais.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            Fornecedor
            <select name="fornecedor_id" defaultValue={d.fornecedor_id ?? ""} className={CAMPO}>
              <option value="">Sem fornecedor</option>
              {props.fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            Conta bancária
            <select name="conta_bancaria_id" defaultValue={d.conta_bancaria_id ?? ""} className={CAMPO}>
              <option value="">Sem conta</option>
              {props.contas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </div>
  );

  const documentos = (
    <div className="space-y-3">
      {TIPOS_DOCUMENTO.map((grupo) => {
        const arquivos = comprovantes.filter((c) => c.tipo_documento === grupo.tipo);
        const outro = TIPOS_DOCUMENTO.find((t) => t.tipo !== grupo.tipo)!;
        return (
          <section key={grupo.tipo} className={`rounded-brand border ${grupo.borda} bg-white p-4`}>
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-sm ${grupo.fundo} ${grupo.cor}`}
              >
                <ActionIcon name={grupo.icone} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-brand-black">{grupo.titulo}</p>
                <p className="text-xs leading-5 text-brand-gray-500">{grupo.ajuda}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {arquivos.length === 0 && (
                <p className="rounded-brand-sm border border-dashed border-brand-gray-300 px-3 py-3 text-center text-xs text-brand-gray-500">
                  {grupo.vazio}
                </p>
              )}
              {arquivos.map((arquivo, indice) => (
                <div key={arquivo.id} className="rounded-brand-sm bg-brand-gray-100/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-brand-black">
                        {arquivo.nome_arquivo || `Arquivo ${indice + 1}`}
                      </p>
                      {arquivo.numero_documento && (
                        <p className="text-[11px] text-brand-gray-600">Nº {arquivo.numero_documento}</p>
                      )}
                      {grupo.tipo === "comprovante_pagamento" &&
                        (arquivo.conta_origem_banco || arquivo.conta_origem_titular || arquivo.metodo_pagamento) && (
                          <p className="text-[11px] leading-4 text-brand-gray-600">
                            {[arquivo.conta_origem_banco, arquivo.conta_origem_titular, arquivo.metodo_pagamento]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {arquivo.url && (
                        <Link
                          href={arquivo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-gray-300 bg-white text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
                          aria-label={`Abrir ${grupo.titulo.toLowerCase()}`}
                          title="Abrir"
                        >
                          <ActionIcon name="file" />
                        </Link>
                      )}
                      <button
                        type="submit"
                        formAction={excluirComprovanteDespesaAction.bind(null, arquivo.id)}
                        formNoValidate
                        className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-status-danger/30 bg-white text-status-danger hover:bg-status-danger/10"
                        aria-label={`Excluir ${grupo.titulo.toLowerCase()}`}
                        title="Excluir (para substituir, anexe o correto depois)"
                      >
                        <ActionIcon name="trash" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    formAction={reclassificarComprovanteDespesaAction.bind(null, arquivo.id, outro.tipo)}
                    formNoValidate
                    className="mt-2 block text-left text-[11px] font-bold text-brand-gray-500 underline-offset-2 hover:text-brand-red hover:underline"
                  >
                    Esse arquivo é {outro.titulo.toLowerCase()}? Mover para lá
                  </button>
                </div>
              ))}
            </div>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-bold text-brand-gray-700">Anexar arquivo</span>
              <input
                type="file"
                name={`arquivo_${grupo.tipo}`}
                accept="image/*,application/pdf"
                className="block w-full rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-xs text-brand-gray-600 file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-brand-black hover:file:bg-brand-gray-200"
              />
            </label>
          </section>
        );
      })}
      <p className="px-1 text-[11px] leading-5 text-brand-gray-500">
        Arquivos escolhidos são enviados quando você clicar em <strong>Salvar alterações</strong>.
      </p>
    </div>
  );

  const origem = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Dado rotulo="Criado por" valor={d.criado_por_nome || d.criado_por_telefone || "Dashboard"} />
        <Dado rotulo="Origem" valor={rotuloOrigem(d.origem, d.criado_por_telefone)} />
        <Dado rotulo="Registrado em" valor={formatDataHoraBrasil(d.created_at)} />
      </div>
      {fornecedorDados && (fornecedorDados.cnpj || fornecedorDados.cpf || fornecedorDados.chave_pix || fornecedorDados.conta_banco) && (
        <section>
          <p className={`mb-2 ${SECAO}`}>Fornecedor, lido do comprovante</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fornecedorDados.cnpj && <Dado rotulo="CNPJ" valor={fornecedorDados.cnpj} />}
            {fornecedorDados.cpf && <Dado rotulo="CPF" valor={fornecedorDados.cpf} />}
            {fornecedorDados.chave_pix && <Dado rotulo="Chave Pix" valor={fornecedorDados.chave_pix} />}
            {fornecedorDados.conta_banco && (
              <Dado
                rotulo="Conta"
                valor={[fornecedorDados.conta_banco, fornecedorDados.conta_agencia, fornecedorDados.conta_numero]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <form action={updateDespesaAction} className="space-y-4 pb-16">
      <input type="hidden" name="id" value={d.id} />
      <input type="hidden" name="despesa_id" value={d.id} />

      <header className="rounded-brand border border-brand-gray-300/70 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <IconeNome nomes={[nomes.material, d.descricao, nomes.categoria]} gerarPara={nomes.categoria} tamanho={48} />
          <div className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-0">
            <p className="line-clamp-3 break-words text-sm font-extrabold leading-snug text-brand-black sm:line-clamp-2">
              {d.descricao || "Sem descrição"}
            </p>
            <p className="mt-0.5 text-xs text-brand-gray-500">
              {[...new Set([nomes.obra, nomes.categoria, nomes.etapa !== "-" ? nomes.etapa : null].filter(Boolean))].join(" · ")}
            </p>
          </div>
          <p className="w-full font-display text-2xl font-black leading-none text-brand-black sm:w-auto sm:shrink-0 sm:text-lg">
            {formatBRL(d.valor)}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Selo ok={temNota} textoOk="Nota anexada" textoPendente="Sem nota" />
          <Selo ok={temPagamento} textoOk="Pago" textoPendente="Pagamento pendente" />
          {nota && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: `${nota.cor}1a`, color: nota.cor }}
            >
              Item {nota.posicao} de {nota.totalItens} da nota · {formatBRL(nota.totalPago)}
              {nota.valorDesconto != null && nota.valorDesconto > 0 ? ` (desc. ${formatBRL(nota.valorDesconto)})` : ""}
            </span>
          )}
        </div>
      </header>

      <AbasModal
        abas={[
          { id: "dados", titulo: "Dados", conteudo: dados },
          {
            id: "documentos",
            titulo: "Documentos",
            selo: comprovantes.length > 0 ? String(comprovantes.length) : undefined,
            conteudo: documentos,
          },
          { id: "origem", titulo: "Origem", conteudo: origem },
        ]}
      />

      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 border-t border-brand-gray-300/70 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <SubmitButton className="w-full rounded-brand-sm bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-red-700 sm:w-auto">
          Salvar alterações
        </SubmitButton>
      </div>
    </form>
  );
}
