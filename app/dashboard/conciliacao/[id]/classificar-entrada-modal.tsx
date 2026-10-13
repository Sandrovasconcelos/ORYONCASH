"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/conversation/format";
import { classificacoesDoTipo, type ClassificacaoCaixa } from "@/lib/caixa/tipos";
import { AppModal } from "../../app-modal";
import { SubmitButton } from "../../submit-button";
import { classificarTransacaoAction } from "../actions";

export type VendaOpcao = { id: string; clienteNome: string; unidade: string | null; obraNome: string | null };
export type ParcelaOpcao = { id: string; vendaId: string; clienteNome: string; numero: number; vencimento: string; valor: number };

const CAMPO = "w-full rounded-brand-sm border border-black/10 bg-white px-3 py-2 text-sm font-medium text-brand-black";
const ROTULO = "flex flex-col gap-1 text-xs font-bold text-brand-gray-600";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export function ClassificarEntradaModal({
  transacaoId,
  extratoId,
  tipo,
  valor,
  data,
  descricao,
  vendas,
  parcelasAbertas,
  parcelasSugeridas,
  obras,
}: {
  transacaoId: string;
  extratoId: string;
  tipo: "credito" | "debito";
  valor: number;
  data: string;
  descricao: string | null;
  vendas: VendaOpcao[];
  parcelasAbertas: ParcelaOpcao[];
  /** Ids das parcelas em aberto que parecem ser esta entrada (melhores primeiro). */
  parcelasSugeridas: string[];
  obras: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const opcoes = classificacoesDoTipo(tipo);
  const [classificacao, setClassificacao] = useState<ClassificacaoCaixa>(tipo === "credito" ? "venda" : "outra_saida");
  const temParcelas = parcelasAbertas.length > 0;
  const [modo, setModo] = useState<"parcela" | "avulsa" | "nova_venda">(parcelasSugeridas.length > 0 ? "parcela" : vendas.length > 0 ? "avulsa" : "nova_venda");

  // Sugeridas primeiro; depois as demais, por vencimento.
  const ordem = new Map(parcelasSugeridas.map((id, i) => [id, i]));
  const parcelasOrdenadas = [...parcelasAbertas].sort((a, b) => (ordem.get(a.id) ?? 999) - (ordem.get(b.id) ?? 999) || a.vencimento.localeCompare(b.vencimento));

  const textoBotao = tipo === "credito" ? "Classificar entrada" : "Classificar saída";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-brand-sm bg-brand-red px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">
        Classificar
      </button>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={tipo === "credito" ? "Entrada sem classificação" : "Saída sem classificação"}
        title={`${formatBRL(valor)} em ${dataBR(data)}`}
        description={descricao || "Sem descrição no extrato"}
        footer={
          <button type="button" onClick={() => setOpen(false)} className="oc-button oc-button-soft">
            Fechar
          </button>
        }
      >
        <form action={classificarTransacaoAction} className="flex flex-col gap-4 text-left">
          <input type="hidden" name="transacao_id" value={transacaoId} />
          <input type="hidden" name="extrato_id" value={extratoId} />

          <label className={ROTULO}>
            O que é essa {tipo === "credito" ? "entrada" : "saída"}?
            <select name="classificacao" value={classificacao} onChange={(e) => setClassificacao(e.target.value as ClassificacaoCaixa)} className={CAMPO}>
              {opcoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                </option>
              ))}
            </select>
            <span className="font-medium text-brand-gray-500">{opcoes.find((o) => o.id === classificacao)?.ajuda}</span>
          </label>

          {classificacao === "venda" && (
            <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-brand-gray-100/60 p-4">
              <input type="hidden" name="modo" value={modo} />
              <div className="flex flex-wrap gap-2">
                {([
                  ["parcela", "Parcela da venda", temParcelas],
                  ["avulsa", "Pagamento avulso de uma venda", vendas.length > 0],
                  ["nova_venda", "Nova venda", true],
                ] as const).map(([id, rotulo, disponivel]) =>
                  disponivel ? (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setModo(id)}
                      className={`rounded-brand-sm px-3 py-1.5 text-xs font-bold ${modo === id ? "bg-brand-black text-white" : "bg-white text-brand-gray-600"}`}
                    >
                      {rotulo}
                    </button>
                  ) : null
                )}
              </div>

              {modo === "parcela" && (
                <label className={ROTULO}>
                  Qual parcela esse pagamento quitou?
                  <select name="parcela_id" required defaultValue={parcelasSugeridas[0] ?? ""} className={CAMPO}>
                    <option value="">Escolha…</option>
                    {parcelasOrdenadas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {parcelasSugeridas.includes(p.id) ? "★ " : ""}
                        {p.clienteNome} · {p.numero === 0 ? "entrada" : `parcela ${p.numero}`} · vence {dataBR(p.vencimento)} · {formatBRL(p.valor)}
                      </option>
                    ))}
                  </select>
                  <span className="font-medium text-brand-gray-500">★ = o valor e a data batem com esta entrada.</span>
                </label>
              )}

              {modo === "avulsa" && (
                <label className={ROTULO}>
                  De qual venda é esse pagamento?
                  <select name="venda_id" required className={CAMPO}>
                    <option value="">Escolha…</option>
                    {vendas.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.clienteNome}
                        {v.unidade ? ` · ${v.unidade}` : ""}
                        {v.obraNome ? ` · ${v.obraNome}` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="font-medium text-brand-gray-500">Entra como um pagamento a mais nessa venda, já recebido.</span>
                </label>
              )}

              {modo === "nova_venda" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={ROTULO}>
                    Cliente
                    <input name="novo_cliente" required placeholder="Nome do comprador" className={CAMPO} />
                  </label>
                  <label className={ROTULO}>
                    Casa / unidade
                    <input name="nova_unidade" placeholder="Ex: Casa 12" className={CAMPO} />
                  </label>
                  <label className={ROTULO}>
                    Obra
                    <select name="nova_obra_id" className={CAMPO}>
                      <option value="">Sem obra</option>
                      {obras.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={ROTULO}>
                    Valor total da casa
                    <input name="novo_valor_total" required inputMode="decimal" placeholder="0,00" className={CAMPO} />
                  </label>
                </div>
              )}
            </div>
          )}

          <label className={ROTULO}>
            Observação (opcional)
            <input
              name="observacao"
              placeholder={classificacao === "aporte" ? "Nome do sócio" : classificacao === "venda" ? "Ex: pagamento referente à entrada" : "Do que se trata"}
              className={CAMPO}
            />
          </label>

          <SubmitButton className="oc-button oc-button-primary self-start" pendingText="Salvando...">
            {textoBotao}
          </SubmitButton>
        </form>
      </AppModal>
    </>
  );
}
