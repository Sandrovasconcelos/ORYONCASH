"use client";

import { useState } from "react";
import { formatBRL, parseValorBR } from "@/lib/conversation/format";
import { gerarParcelas } from "@/lib/vendas/parcelas";
import { SubmitButton } from "../submit-button";
import { FecharAoEnviar } from "../fechar-ao-enviar";
import { criarVendaAction } from "./actions";

const CAMPO = "w-full rounded-brand-sm border border-black/10 bg-white px-3 py-2 text-sm font-medium text-brand-black";
const ROTULO = "flex flex-col gap-1 text-xs font-bold text-brand-gray-600";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export function NovaVendaForm({ obras, hoje }: { obras: { id: string; nome: string }[]; hoje: string }) {
  const [total, setTotal] = useState("");
  const [entrada, setEntrada] = useState("");
  const [entradaData, setEntradaData] = useState(hoje);
  const [qtd, setQtd] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [primeiro, setPrimeiro] = useState("");
  const [jaPagas, setJaPagas] = useState("");

  const valorTotal = parseValorBR(total) ?? 0;
  const parcelas =
    valorTotal > 0
      ? gerarParcelas({
          valorTotal,
          entradaValor: parseValorBR(entrada) ?? 0,
          entradaData: entradaData || null,
          quantidade: Number(qtd) || 0,
          primeiroVencimento: primeiro || entradaData || hoje,
          valorParcela: parseValorBR(valorParcela) ?? null,
        })
      : [];
  const somaGerada = parcelas.reduce((s, p) => s + p.valor, 0);
  const diferenca = Math.round((valorTotal - somaGerada) * 100) / 100;

  return (
    <form action={criarVendaAction} className="flex flex-col gap-4 text-left">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={ROTULO}>
          Cliente
          <input name="cliente_nome" required placeholder="Nome do comprador" className={CAMPO} />
        </label>
        <label className={ROTULO}>
          Casa / unidade
          <input name="unidade" placeholder="Ex: Casa 12" className={CAMPO} />
        </label>
        <label className={ROTULO}>
          Obra
          <select name="obra_id" className={CAMPO}>
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
          <input name="valor_total" required inputMode="decimal" placeholder="0,00" value={total} onChange={(e) => setTotal(e.target.value)} className={CAMPO} />
        </label>
        <label className={ROTULO}>
          Telefone (opcional)
          <input name="cliente_telefone" className={CAMPO} />
        </label>
        <label className={ROTULO}>
          CPF/CNPJ (opcional)
          <input name="cliente_documento" className={CAMPO} />
        </label>
        <label className={ROTULO}>
          Data do contrato
          <input type="date" name="data_contrato" defaultValue={hoje} className={CAMPO} />
        </label>
      </div>

      <div className="rounded-card border border-brand-gray-300/60 bg-brand-gray-100/60 p-4">
        <p className="mb-3 text-sm font-bold text-brand-black">Como o cliente paga</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={ROTULO}>
            Entrada (R$)
            <input name="entrada_valor" inputMode="decimal" placeholder="0,00" value={entrada} onChange={(e) => setEntrada(e.target.value)} className={CAMPO} />
          </label>
          <label className={ROTULO}>
            Data da entrada
            <input type="date" name="entrada_data" value={entradaData} onChange={(e) => setEntradaData(e.target.value)} className={CAMPO} />
          </label>
          <label className={ROTULO}>
            Quantidade de parcelas mensais
            <input name="quantidade" type="number" min={0} max={600} placeholder="0" value={qtd} onChange={(e) => setQtd(e.target.value)} className={CAMPO} />
          </label>
          <label className={ROTULO}>
            Valor de cada parcela (vazio = divide igual)
            <input name="valor_parcela" inputMode="decimal" placeholder="0,00" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} className={CAMPO} />
          </label>
          <label className={ROTULO}>
            Vencimento da 1ª parcela
            <input type="date" name="primeiro_vencimento" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} required={Number(qtd) > 0} className={CAMPO} />
          </label>
          <label className={ROTULO}>
            Quantas já foram pagas (a partir da entrada)
            <input name="ja_pagas" type="number" min={0} placeholder="0" value={jaPagas} onChange={(e) => setJaPagas(e.target.value)} className={CAMPO} />
          </label>
        </div>

        {parcelas.length > 0 && (
          <div className="mt-4 text-xs text-brand-gray-600">
            <p className="font-bold text-brand-black">
              {parcelas.length} parcela(s) serão criadas
              {Number(jaPagas) > 0 ? `, ${Math.min(Number(jaPagas), parcelas.length)} já como pagas` : ""}:
            </p>
            <ul className="mt-1 flex max-h-32 flex-col gap-0.5 overflow-y-auto">
              {parcelas.map((p, i) => (
                <li key={`${p.numero}-${p.vencimento}`} className="flex justify-between gap-3">
                  <span>
                    {p.numero === 0 ? "Entrada" : `Parcela ${p.numero}`} · {dataBR(p.vencimento)}
                    {i < (Number(jaPagas) || 0) ? " · paga" : ""}
                  </span>
                  <span className="font-semibold text-brand-black">{formatBRL(p.valor)}</span>
                </li>
              ))}
            </ul>
            {Math.abs(diferenca) >= 0.01 && (
              <p className="mt-2 font-semibold text-status-warning">
                {diferenca > 0 ? `Falta ${formatBRL(diferenca)}` : `Passa ${formatBRL(-diferenca)}`} para fechar o valor total. Você pode ajustar depois ou
                adicionar uma parcela avulsa.
              </p>
            )}
          </div>
        )}
      </div>

      <label className={ROTULO}>
        Observação (opcional)
        <input name="observacao" className={CAMPO} />
      </label>
      <FecharAoEnviar />
      <SubmitButton className="oc-button oc-button-primary self-start" pendingText="Cadastrando...">
        Cadastrar venda
      </SubmitButton>
    </form>
  );
}
