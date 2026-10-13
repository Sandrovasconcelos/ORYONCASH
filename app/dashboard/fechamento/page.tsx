import Link from "next/link";
import { formatBRL } from "@/lib/conversation/format";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { formatDataBrasil } from "@/lib/format-date";
import { limitesDoMes, nomeDoMes } from "@/lib/caixa/fechamento";
import { carregarFechamento, listarContasDoFechamento } from "@/lib/caixa/queries";
import { ImprimirBotao } from "./imprimir-botao";

export const dynamic = "force-dynamic";

type Params = { mes?: string; conta?: string };

function Linha({ rotulo, valor, tom, destaque = false, sub }: { rotulo: string; valor: number | null; tom?: "entrada" | "saida"; destaque?: boolean; sub?: string }) {
  return (
    <div className={`flex items-start justify-between gap-3 px-5 py-2.5 text-sm ${destaque ? "bg-brand-gray-100 font-bold" : ""}`}>
      <div>
        <p className={destaque ? "text-brand-black" : "text-brand-gray-700"}>{rotulo}</p>
        {sub && <p className="text-[11px] text-brand-gray-500">{sub}</p>}
      </div>
      <p className={`shrink-0 font-bold ${tom === "entrada" ? "text-status-success" : tom === "saida" ? "text-status-danger" : "text-brand-black"}`}>
        {valor === null ? "—" : `${tom === "saida" && valor > 0 ? "− " : tom === "entrada" && valor > 0 ? "+ " : ""}${formatBRL(Math.abs(valor))}`}
      </p>
    </div>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return <p className="bg-brand-gray-100/70 px-5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-gray-500">{titulo}</p>;
}

export default async function FechamentoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const hoje = hojeNoBrasil();
  const mes = params.mes && limitesDoMes(params.mes) ? params.mes : hoje.slice(0, 7);
  const limites = limitesDoMes(mes)!;

  const contas = await listarContasDoFechamento();
  const correntes = contas.filter((c) => c.tipo === "corrente");
  const investimentos = contas.filter((c) => c.tipo === "investimento");

  if (contas.length === 0) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Fechamento de caixa ainda não está pronto.</p>
        <p className="mt-1">
          Aplique a migration <code>20261017010000_entradas_vendas_fechamento.sql</code> e cadastre as contas em{" "}
          <Link href="/dashboard/contas" className="font-bold underline">
            Contas bancárias
          </Link>
          .
        </p>
      </div>
    );
  }

  const conta = correntes.find((c) => c.id === params.conta) ?? correntes[0];
  if (!conta) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        Nenhuma conta corrente. Em{" "}
        <Link href="/dashboard/contas" className="font-bold underline">
          Contas bancárias
        </Link>
        , marque o tipo da conta como Conta corrente.
      </div>
    );
  }

  const dados = await carregarFechamento(conta, mes, investimentos);
  if (!dados) return null;
  const f = dados.fechamento;
  const href = (m: string) => `/dashboard/fechamento?mes=${m}&conta=${conta.id}`;

  const confere = f.diferenca !== null && Math.abs(f.diferenca) < 0.01;
  let situacao: { texto: string; classe: string };
  if (f.saldoFinalCalculado === null) {
    situacao = { texto: "Falta o saldo inicial desta conta (informe em Contas › Caixa e saldos).", classe: "border-status-warning/30 bg-status-warning/10 text-status-warning" };
  } else if (f.diferenca === null) {
    situacao = {
      texto: `Informe o saldo do extrato do dia ${formatDataBrasil(limites.fim)} (em Contas › Caixa e saldos) para conferir.`,
      classe: "border-status-warning/30 bg-status-warning/10 text-status-warning",
    };
  } else if (confere) {
    situacao = { texto: "Saldo confere com o extrato do banco.", classe: "border-status-success/30 bg-status-success/10 text-status-success" };
  } else {
    situacao = {
      texto: `Diferença de ${formatBRL(Math.abs(f.diferenca))} ${f.diferenca > 0 ? "a mais" : "a menos"} no banco do que no sistema. Provavelmente falta importar algum extrato ou lançamento.`,
      classe: "border-status-danger/30 bg-status-danger/10 text-status-danger",
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-brand-black">Fechamento de caixa</h1>
          <p className="mt-1 text-sm text-brand-gray-600">Tudo que entrou e saiu da conta no mês, por tipo, conferido com o saldo do banco.</p>
        </div>
        <ImprimirBotao />
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex items-center gap-1 rounded-brand-sm border border-black/10 bg-white">
          <Link href={href(limites.anterior)} className="px-3 py-2 text-sm font-bold text-brand-black hover:bg-brand-gray-100" aria-label="Mês anterior">
            ←
          </Link>
          <span className="min-w-[10rem] text-center text-sm font-bold capitalize text-brand-black">{nomeDoMes(mes)}</span>
          <Link href={href(limites.proximo)} className="px-3 py-2 text-sm font-bold text-brand-black hover:bg-brand-gray-100" aria-label="Próximo mês">
            →
          </Link>
        </div>
        {correntes.length > 1 && (
          <form action="/dashboard/fechamento" className="flex items-center gap-2">
            <input type="hidden" name="mes" value={mes} />
            <select name="conta" defaultValue={conta.id} className="rounded-brand-sm border border-black/10 bg-white px-3 py-2 text-sm font-medium text-brand-black">
              {correntes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <button type="submit" className="oc-button oc-button-dark text-xs">
              Ver
            </button>
          </form>
        )}
      </div>

      <p className="hidden text-sm font-bold text-brand-black print:block">
        {conta.nome} · {nomeDoMes(mes)}
      </p>

      <div className={`rounded-card border px-4 py-3 text-sm font-semibold ${situacao.classe}`}>{situacao.texto}</div>

      {dados.semExtrato && (
        <p className="rounded-card border border-brand-gray-300/60 bg-white p-4 text-sm text-brand-gray-600 shadow-card">
          Nenhum extrato desta conta com movimento em {nomeDoMes(mes)}. Envie o extrato em{" "}
          <Link href="/dashboard/conciliacao" className="font-bold underline">
            Conciliação bancária
          </Link>
          .
        </p>
      )}

      {f.naoClassificadas > 0 && (
        <p className="rounded-card border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-brand-gray-700 shadow-card print:hidden">
          <strong className="text-brand-black">{f.naoClassificadas} movimento(s) sem classificação</strong> neste mês. Eles já entram no saldo, mas aparecem como “sem classificação”.{" "}
          <Link href="/dashboard/conciliacao" className="font-bold text-brand-red underline">
            Resolver na conciliação
          </Link>
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-black/5 bg-white shadow-card">
        <Linha rotulo={`Saldo inicial, ${conta.nome}`} valor={f.saldoInicial} destaque sub={dados.origemDaAbertura ?? undefined} />

        <Secao titulo="Entradas" />
        <Linha rotulo="Vendas de imóveis" valor={f.entradas.venda} tom="entrada" />
        <Linha rotulo="Aportes de sócios" valor={f.entradas.aporte} tom="entrada" />
        <Linha rotulo="Rendimentos" valor={f.entradas.rendimento} tom="entrada" />
        <Linha rotulo="Outras entradas" valor={f.entradas.outraEntrada} tom="entrada" />
        {f.entradas.naoClassificadas > 0 && <Linha rotulo="Entradas sem classificação" valor={f.entradas.naoClassificadas} tom="entrada" />}
        <Linha rotulo="Total de entradas" valor={f.entradas.total} destaque />

        <Secao titulo="Saídas" />
        {f.saidas.porObra.map((o) => (
          <Linha key={o.nome} rotulo={o.nome} valor={o.total} tom="saida" />
        ))}
        {f.saidas.outraSaida > 0 && <Linha rotulo="Outras saídas" valor={f.saidas.outraSaida} tom="saida" />}
        {f.saidas.naoClassificadas > 0 && <Linha rotulo="Saídas sem classificação" valor={f.saidas.naoClassificadas} tom="saida" />}
        {f.saidas.porObra.length === 0 && f.saidas.outraSaida === 0 && f.saidas.naoClassificadas === 0 && <p className="px-5 py-2.5 text-sm text-brand-gray-500">Nenhuma saída no mês.</p>}
        <Linha rotulo="Total de saídas" valor={f.saidas.total} destaque />

        <Secao titulo="Transferências entre contas (não são receita nem despesa)" />
        <Linha rotulo="Resgates do investimento" valor={f.transferencias.resgates} tom="entrada" />
        <Linha rotulo="Aplicações no investimento" valor={f.transferencias.aplicacoes} tom="saida" />

        <Linha rotulo="Saldo final calculado" valor={f.saldoFinalCalculado} destaque sub="saldo inicial + tudo que entrou − tudo que saiu" />
        <Linha rotulo={`Saldo no extrato do banco (${formatDataBrasil(limites.fim)})`} valor={f.saldoFinalInformado} />
        <Linha rotulo="Diferença" valor={f.diferenca} destaque />
      </div>

      {dados.investimento && (
        <div className="overflow-hidden rounded-card border border-black/5 bg-white shadow-card">
          <Linha rotulo={`Investimento, ${dados.investimento.conta.nome}`} valor={null} destaque />
          <Linha rotulo="Posição no início do mês" valor={dados.investimento.posicaoInicial} />
          <Linha rotulo="Aplicações do mês" valor={f.transferencias.aplicacoes} tom="entrada" />
          <Linha rotulo="Resgates do mês" valor={f.transferencias.resgates} tom="saida" />
          <Linha
            rotulo="Rendimento do mês"
            valor={dados.investimento.rendimento}
            tom="entrada"
            sub="posição final − inicial − aplicações + resgates (precisa das posições informadas)"
          />
          <Linha rotulo="Posição no fim do mês" valor={dados.investimento.posicaoFinal} destaque />
        </div>
      )}
    </div>
  );
}
