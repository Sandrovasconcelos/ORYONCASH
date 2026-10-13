import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { formatDataBrasil } from "@/lib/format-date";
import { resumirVenda, situacaoDaParcela, type StatusParcela } from "@/lib/vendas/parcelas";
import { CadastroModal } from "../cadastro-modal";
import { ActionIcon } from "../action-icon";
import { SubmitButton } from "../submit-button";
import { FecharAoEnviar } from "../fechar-ao-enviar";
import { ExcluirComConfirmacao } from "../excluir-com-confirmacao";
import { NovaVendaForm } from "./nova-venda-form";
import {
  adicionarParcelaAction,
  atualizarParcelaAction,
  atualizarVendaAction,
  desfazerRecebimentoAction,
  excluirParcelaAction,
  excluirVendaAction,
  receberParcelaAction,
} from "./actions";

export const dynamic = "force-dynamic";

const CAMPO = "w-full rounded-brand-sm border border-black/10 bg-white px-3 py-2 text-sm font-medium text-brand-black";
const ROTULO = "flex flex-col gap-1 text-xs font-bold text-brand-gray-600";

function valorInputBR(valor: number) {
  return Number(valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Parcela = {
  id: string;
  venda_id: string;
  numero: number;
  tipo: string;
  vencimento: string;
  valor: number;
  status: StatusParcela;
  recebido_em: string | null;
  valor_recebido: number | null;
};

const TEXTO_SITUACAO = {
  recebida: { texto: "Recebida", classe: "bg-status-success/15 text-status-success" },
  atrasada: { texto: "Atrasada", classe: "bg-status-danger/15 text-status-danger" },
  vence_hoje: { texto: "Vence hoje", classe: "bg-status-warning/15 text-status-warning" },
  a_vencer: { texto: "A receber", classe: "bg-brand-gray-300/40 text-brand-gray-600" },
  cancelada: { texto: "Cancelada", classe: "bg-brand-gray-300/40 text-brand-gray-500" },
} as const;

function nomeDaParcela(p: Pick<Parcela, "numero" | "tipo">) {
  if (p.tipo === "entrada" || p.numero === 0) return "Entrada";
  if (p.tipo === "outra") return `Pagamento avulso ${p.numero}`;
  if (p.tipo === "intermediaria") return `Intermediária ${p.numero}`;
  if (p.tipo === "chaves") return "Chaves";
  return `Parcela ${p.numero}`;
}

export default async function VendasPage() {
  const supabase = createAdminClient();
  const hoje = hojeNoBrasil();

  const [vendasRes, parcelasRes, { data: obras }, { data: contas }, { data: ligadas }] = await Promise.all([
    supabase.from("vendas").select("*, obras(nome)").order("created_at", { ascending: false }).limit(500),
    supabase.from("parcelas_venda").select("*").order("numero").limit(10000),
    supabase.from("obras").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("contas_bancarias").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("extrato_transacoes").select("parcela_id").not("parcela_id", "is", null).limit(10000),
  ]);

  if (vendasRes.error || parcelasRes.error) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Vendas ainda não ativado no Supabase.</p>
        <p className="mt-1">
          Aplique a migration <code>20261017010000_entradas_vendas_fechamento.sql</code> pra liberar essa tela.
        </p>
      </div>
    );
  }

  const parcelasPorVenda = new Map<string, Parcela[]>();
  for (const p of (parcelasRes.data ?? []) as Parcela[]) {
    const lista = parcelasPorVenda.get(p.venda_id) ?? [];
    lista.push(p);
    parcelasPorVenda.set(p.venda_id, lista);
  }
  const conciliadas = new Set((ligadas ?? []).map((l) => l.parcela_id));
  const vendas = vendasRes.data ?? [];

  const ativas = vendas.filter((v) => v.status !== "cancelada");
  const totais = ativas.reduce(
    (acc, v) => {
      const r = resumirVenda(parcelasPorVenda.get(v.id) ?? [], hoje);
      acc.vendido += r.total;
      acc.recebido += r.recebido;
      acc.aReceber += r.aReceber;
      acc.atrasado += r.atrasado;
      return acc;
    },
    { vendido: 0, recebido: 0, aReceber: 0, atrasado: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-brand-black">Vendas e recebimentos</h1>
          <p className="mt-1 text-sm text-brand-gray-600">
            Casas vendidas parceladas direto pela construtora: parcelas, o que já entrou e o que falta receber. A conciliação bancária confirma cada
            pagamento pelo extrato.
          </p>
        </div>
        <CadastroModal titulo="Nova venda" descricao="Cadastre uma vez: as parcelas são geradas sozinhas." botao="+ Nova venda" variante="primario" modalSize="wide">
          <NovaVendaForm obras={obras ?? []} hoje={hoje} />
        </CadastroModal>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Vendido", totais.vendido, "text-brand-black"],
          ["Recebido", totais.recebido, "text-status-success"],
          ["A receber", totais.aReceber, "text-brand-black"],
          ["Atrasado", totais.atrasado, totais.atrasado > 0 ? "text-status-danger" : "text-brand-black"],
        ].map(([rotulo, valor, cor]) => (
          <div key={rotulo as string} className="rounded-card border border-black/5 bg-white px-4 py-3 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-gray-500">{rotulo as string}</p>
            <p className={`mt-1 text-lg font-black ${cor}`}>{formatBRL(valor as number)}</p>
          </div>
        ))}
      </div>

      {vendas.length === 0 && (
        <p className="rounded-card border border-brand-gray-300/60 bg-white p-5 text-sm text-brand-gray-500 shadow-card">
          Nenhuma venda cadastrada. Use <strong>+ Nova venda</strong>. Se ela já pagou parte, informe quantas parcelas já foram pagas.
        </p>
      )}

      {vendas.map((v) => {
        const parcelas = parcelasPorVenda.get(v.id) ?? [];
        const r = resumirVenda(parcelas, hoje);
        const obraNome = (v as { obras?: { nome: string } | null }).obras?.nome ?? null;
        const cancelada = v.status === "cancelada";
        return (
          <section key={v.id} className={`rounded-card border border-black/5 bg-white shadow-card ${cancelada ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-base font-black text-brand-black">
                  {v.cliente_nome}
                  {v.status === "quitada" && <span className="ml-2 rounded-full bg-status-success/15 px-2 py-0.5 text-[11px] font-bold text-status-success">Quitada</span>}
                  {cancelada && <span className="ml-2 rounded-full bg-brand-gray-300/40 px-2 py-0.5 text-[11px] font-bold text-brand-gray-500">Cancelada</span>}
                  {r.atrasadas > 0 && !cancelada && (
                    <span className="ml-2 rounded-full bg-status-danger/15 px-2 py-0.5 text-[11px] font-bold text-status-danger">
                      {r.atrasadas} atrasada{r.atrasadas > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
                <p className="text-xs text-brand-gray-500">
                  {[v.unidade, obraNome, v.data_contrato ? `contrato ${formatDataBrasil(v.data_contrato)}` : null].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CadastroModal titulo="Editar venda" descricao="Dados do cliente e da venda." botao="Editar" icone={<ActionIcon name="edit" />} variante="icone">
                  <form action={atualizarVendaAction} className="flex flex-col gap-4 text-left">
                    <input type="hidden" name="id" value={v.id} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className={ROTULO}>
                        Cliente
                        <input name="cliente_nome" required defaultValue={v.cliente_nome} className={CAMPO} />
                      </label>
                      <label className={ROTULO}>
                        Casa / unidade
                        <input name="unidade" defaultValue={v.unidade ?? ""} className={CAMPO} />
                      </label>
                      <label className={ROTULO}>
                        Obra
                        <select name="obra_id" defaultValue={v.obra_id ?? ""} className={CAMPO}>
                          <option value="">Sem obra</option>
                          {(obras ?? []).map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={ROTULO}>
                        Valor total
                        <input name="valor_total" required defaultValue={valorInputBR(v.valor_total)} className={CAMPO} />
                      </label>
                      <label className={ROTULO}>
                        Telefone
                        <input name="cliente_telefone" defaultValue={v.cliente_telefone ?? ""} className={CAMPO} />
                      </label>
                      <label className={ROTULO}>
                        CPF/CNPJ
                        <input name="cliente_documento" defaultValue={v.cliente_documento ?? ""} className={CAMPO} />
                      </label>
                      <label className={ROTULO}>
                        Data do contrato
                        <input type="date" name="data_contrato" defaultValue={v.data_contrato ?? ""} className={CAMPO} />
                      </label>
                      <label className={ROTULO}>
                        Observação
                        <input name="observacao" defaultValue={v.observacao ?? ""} className={CAMPO} />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-brand-gray-600">
                      <input type="checkbox" name="cancelada" defaultChecked={cancelada} /> Venda cancelada (não conta nos totais)
                    </label>
                    <FecharAoEnviar />
                    <SubmitButton className="oc-button oc-button-primary self-start">Salvar alterações</SubmitButton>
                  </form>
                </CadastroModal>
                <ExcluirComConfirmacao
                  id={v.id}
                  titulo="Excluir venda?"
                  descricao={
                    <>
                      <span className="font-semibold text-brand-black">{v.cliente_nome}</span> e todas as parcelas serão apagadas. Entradas do extrato ligadas a ela voltam a
                      ficar sem classificação na conciliação.
                    </>
                  }
                  action={excluirVendaAction}
                  rotulo="Excluir venda"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 pb-3 sm:grid-cols-4">
              <Info rotulo="Valor da casa" valor={formatBRL(v.valor_total)} />
              <Info rotulo="Recebido" valor={formatBRL(r.recebido)} cor="text-status-success" />
              <Info rotulo="A receber" valor={formatBRL(r.aReceber)} />
              <Info rotulo="Próxima" valor={r.proxima ? `${formatDataBrasil(r.proxima.vencimento)} · ${formatBRL(r.proxima.valor)}` : "—"} />
            </div>
            <div className="px-5 pb-4">
              <div className="h-2 overflow-hidden rounded-full bg-brand-gray-100">
                <div className="h-full rounded-full bg-status-success" style={{ width: `${r.percentualPago}%` }} />
              </div>
              <p className="mt-1 text-xs text-brand-gray-500">{r.percentualPago}% pago</p>
            </div>

            <details className="border-t border-black/5" open={r.atrasadas > 0}>
              <summary className="cursor-pointer px-5 py-3 text-sm font-bold text-brand-black">Parcelas ({parcelas.length})</summary>
              <ul className="divide-y divide-black/5">
                {parcelas.map((p) => {
                  const situacao = situacaoDaParcela(p, hoje);
                  const info = TEXTO_SITUACAO[situacao];
                  const conciliada = conciliadas.has(p.id);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="min-w-[8rem] font-semibold text-brand-black">{nomeDaParcela(p)}</span>
                      <span className="text-xs text-brand-gray-500">
                        {p.status === "recebida" && p.recebido_em ? `recebida em ${formatDataBrasil(p.recebido_em)}` : `vence ${formatDataBrasil(p.vencimento)}`}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${info.classe}`}>{info.texto}</span>
                      {conciliada && <span className="rounded-full bg-status-info/15 px-2 py-0.5 text-[11px] font-bold text-status-info">Conciliada</span>}
                      <span className="ml-auto font-bold text-brand-black">{formatBRL(p.status === "recebida" ? (p.valor_recebido ?? p.valor) : p.valor)}</span>
                      <span className="flex items-center gap-1.5">
                        {p.status === "a_receber" && (
                          <CadastroModal titulo="Registrar recebimento" descricao={`${nomeDaParcela(p)} de ${v.cliente_nome}`} botao="Receber" triggerClassName="rounded-brand-sm bg-brand-black px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">
                            <form action={receberParcelaAction} className="flex flex-col gap-4 text-left">
                              <input type="hidden" name="id" value={p.id} />
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className={ROTULO}>
                                  Data do recebimento
                                  <input type="date" name="recebido_em" required defaultValue={hoje} className={CAMPO} />
                                </label>
                                <label className={ROTULO}>
                                  Valor recebido
                                  <input name="valor_recebido" required defaultValue={valorInputBR(p.valor)} className={CAMPO} />
                                </label>
                                <label className={`${ROTULO} sm:col-span-2`}>
                                  Conta onde entrou
                                  <select name="conta_bancaria_id" className={CAMPO}>
                                    <option value="">Não informar</option>
                                    {(contas ?? []).map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.nome}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <p className="text-xs text-brand-gray-500">Depois, na conciliação, você liga esse recebimento ao crédito do extrato.</p>
                              <FecharAoEnviar />
                              <SubmitButton className="oc-button oc-button-primary self-start">Registrar</SubmitButton>
                            </form>
                          </CadastroModal>
                        )}
                        {p.status === "recebida" && !conciliada && (
                          <form action={desfazerRecebimentoAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="text-xs font-bold text-brand-gray-500 hover:text-brand-red">
                              Desfazer
                            </button>
                          </form>
                        )}
                        <CadastroModal titulo="Editar parcela" descricao={nomeDaParcela(p)} botao="Editar" icone={<ActionIcon name="edit" />} variante="icone" triggerClassName="inline-flex h-8 w-8 items-center justify-center rounded-brand-sm bg-brand-black text-white hover:bg-brand-red">
                          <form action={atualizarParcelaAction} className="flex flex-col gap-4 text-left">
                            <input type="hidden" name="id" value={p.id} />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <label className={ROTULO}>
                                Vencimento
                                <input type="date" name="vencimento" required defaultValue={p.vencimento} className={CAMPO} />
                              </label>
                              <label className={ROTULO}>
                                Valor
                                <input name="valor" required defaultValue={valorInputBR(p.valor)} className={CAMPO} />
                              </label>
                            </div>
                            <FecharAoEnviar />
                            <SubmitButton className="oc-button oc-button-primary self-start">Salvar</SubmitButton>
                          </form>
                        </CadastroModal>
                        <ExcluirComConfirmacao
                          id={p.id}
                          titulo="Excluir parcela?"
                          descricao={`${nomeDaParcela(p)} (${formatBRL(p.valor)}) será apagada${conciliada ? " e o crédito do extrato volta a ficar sem classificação" : ""}.`}
                          action={excluirParcelaAction}
                          rotulo="Excluir parcela"
                          compacto
                        />
                      </span>
                    </li>
                  );
                })}
                {parcelas.length === 0 && <li className="px-5 py-3 text-sm text-brand-gray-500">Sem parcelas. Adicione abaixo.</li>}
              </ul>
              <div className="border-t border-black/5 px-5 py-3">
                <CadastroModal titulo="Adicionar parcela" descricao={`Mais uma parcela para ${v.cliente_nome}`} botao="+ Adicionar parcela" triggerClassName="text-xs font-bold text-brand-red hover:underline">
                  <form action={adicionarParcelaAction} className="flex flex-col gap-4 text-left">
                    <input type="hidden" name="venda_id" value={v.id} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className={ROTULO}>
                        Tipo
                        <select name="tipo" className={CAMPO}>
                          <option value="parcela">Parcela</option>
                          <option value="intermediaria">Intermediária</option>
                          <option value="chaves">Chaves</option>
                          <option value="outra">Outra</option>
                        </select>
                      </label>
                      <label className={ROTULO}>
                        Vencimento
                        <input type="date" name="vencimento" required className={CAMPO} />
                      </label>
                      <label className={ROTULO}>
                        Valor
                        <input name="valor" required inputMode="decimal" placeholder="0,00" className={CAMPO} />
                      </label>
                    </div>
                    <FecharAoEnviar />
                    <SubmitButton className="oc-button oc-button-primary self-start">Adicionar</SubmitButton>
                  </form>
                </CadastroModal>
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}

function Info({ rotulo, valor, cor = "text-brand-black" }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-gray-500">{rotulo}</p>
      <p className={`mt-0.5 text-sm font-black ${cor}`}>{valor}</p>
    </div>
  );
}
