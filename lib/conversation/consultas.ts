import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/messages";
import { formatBRL } from "./format";
import { hojeNoBrasil } from "./queries";
import { candidatosPorPista } from "./agruparPorNome";
import { periodosComparativos, type Intervalo, type TipoPeriodoComparativo } from "./periodosComparativos";
import { descreverVariacao, percentualDoOrcamento } from "./consultasTexto";

const PAGINA = 1000;

/** O PostgREST devolve no maximo 1000 linhas por chamada: le tudo em paginas. */
async function lerTudo<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data } = await pagina(de, de + PAGINA - 1);
    const lote = data ?? [];
    todas.push(...lote);
    if (lote.length < PAGINA) return todas;
  }
}

function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function trecho(i: Intervalo): string {
  return i.inicio === i.fim ? dataCurta(i.inicio) : `${dataCurta(i.inicio)} a ${dataCurta(i.fim)}`;
}

// ---------------------------------------------------------------- orçamento

export async function responderOrcamento(to: string, termoObra: string | null): Promise<void> {
  const supabase = createAdminClient();
  const { data: obrasBrutas } = await supabase
    .from("obras")
    .select("id, nome, orcamento_total, status")
    .is("deleted_at", null)
    .limit(500);
  let obras = obrasBrutas ?? [];

  if (termoObra) {
    const achadas = candidatosPorPista(obras, termoObra);
    if (achadas.length === 0) {
      await sendText(to, `🤔 Não encontrei a obra "${termoObra}". Confere o nome e tenta de novo.`);
      return;
    }
    if (achadas.length > 1) {
      const lista = achadas.slice(0, 6).map((o) => `• ${o.nome}`).join("\n");
      await sendText(to, `🤔 Achei mais de uma obra para "${termoObra}":\n${lista}\n\nPergunte de novo com o nome completo.`);
      return;
    }
    obras = achadas;
  } else {
    obras = obras.filter((o) => o.status === "ativa" && o.orcamento_total > 0);
    if (obras.length === 0) {
      await sendText(to, "📭 Nenhuma obra ativa tem orçamento cadastrado ainda.");
      return;
    }
  }

  const ids = obras.map((o) => o.id);
  const despesas = await lerTudo((de, ate) =>
    supabase
      .from("despesas")
      .select("obra_id, etapa_id, valor")
      .is("deleted_at", null)
      .in("obra_id", ids)
      .order("id")
      .range(de, ate)
  );

  const gastoDaObra = new Map<string, number>();
  for (const d of despesas) gastoDaObra.set(d.obra_id ?? "", (gastoDaObra.get(d.obra_id ?? "") ?? 0) + d.valor);

  if (obras.length > 1) {
    const linhas = obras.map((o) => {
      const gasto = gastoDaObra.get(o.id) ?? 0;
      const pct = percentualDoOrcamento(gasto, o.orcamento_total);
      return `🏗️ *${o.nome}*\n   Orçamento ${formatBRL(o.orcamento_total)} · gasto ${formatBRL(gasto)} (${pct}%) · saldo ${formatBRL(o.orcamento_total - gasto)}`;
    });
    await sendText(to, `📊 *Orçamento das obras ativas*\n\n${linhas.join("\n\n")}`);
    return;
  }

  const obra = obras[0];
  const gasto = gastoDaObra.get(obra.id) ?? 0;
  if (!(obra.orcamento_total > 0)) {
    await sendText(
      to,
      `🏗️ *${obra.nome}*\nEssa obra ainda não tem orçamento cadastrado.\nGasto até agora: ${formatBRL(gasto)}.`
    );
    return;
  }

  const pct = percentualDoOrcamento(gasto, obra.orcamento_total);
  const saldo = obra.orcamento_total - gasto;
  let texto =
    `🏗️ *${obra.nome}*\n` +
    `Orçamento: ${formatBRL(obra.orcamento_total)}\n` +
    `Gasto até agora: ${formatBRL(gasto)} (${pct}%)\n` +
    (saldo >= 0 ? `Saldo: ${formatBRL(saldo)}` : `⚠️ Estourou o orçamento em ${formatBRL(-saldo)}`);

  const { data: etapas } = await supabase
    .from("etapas")
    .select("id, nome, valor_orcado")
    .eq("obra_id", obra.id)
    .is("deleted_at", null);
  const gastoDaEtapa = new Map<string, number>();
  for (const d of despesas) {
    if (d.obra_id === obra.id && d.etapa_id) gastoDaEtapa.set(d.etapa_id, (gastoDaEtapa.get(d.etapa_id) ?? 0) + d.valor);
  }
  const comOrcamento = (etapas ?? [])
    .filter((e) => (e.valor_orcado ?? 0) > 0)
    .map((e) => ({ nome: e.nome, orcado: e.valor_orcado ?? 0, gasto: gastoDaEtapa.get(e.id) ?? 0 }))
    .sort((a, b) => b.gasto / b.orcado - a.gasto / a.orcado)
    .slice(0, 5);
  if (comOrcamento.length > 0) {
    texto +=
      "\n\n📌 *Etapas mais consumidas*\n" +
      comOrcamento
        .map((e) => {
          const p = percentualDoOrcamento(e.gasto, e.orcado);
          return `• ${e.nome}: ${formatBRL(e.gasto)} de ${formatBRL(e.orcado)} (${p}%${p > 100 ? " ⚠️" : ""})`;
        })
        .join("\n");
  }
  await sendText(to, texto);
}

// -------------------------------------------------------------- comparativo

async function gastosDoIntervalo(intervalo: Intervalo) {
  const supabase = createAdminClient();
  const linhas = await lerTudo((de, ate) =>
    supabase
      .from("despesas")
      .select("valor, categorias(nome)")
      .is("deleted_at", null)
      .gte("data", intervalo.inicio)
      .lte("data", intervalo.fim)
      .order("id")
      .range(de, ate)
  );
  const porCategoria = new Map<string, number>();
  let total = 0;
  for (const l of linhas) {
    total += l.valor;
    const nome = (l.categorias as unknown as { nome: string } | null)?.nome ?? "Sem categoria";
    porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + l.valor);
  }
  return { total, porCategoria };
}

export async function responderComparativo(to: string, tipo: TipoPeriodoComparativo): Promise<void> {
  const c = periodosComparativos(hojeNoBrasil(), tipo);
  const [atual, anterior] = await Promise.all([gastosDoIntervalo(c.atual), gastosDoIntervalo(c.anterior)]);

  let texto =
    `📊 *Gastos: ${c.rotuloAtual.toLowerCase()} × ${c.rotuloAnterior.toLowerCase()}* (mesmo trecho)\n\n` +
    `${c.rotuloAtual} (${trecho(c.atual)}): *${formatBRL(atual.total)}*\n` +
    `${c.rotuloAnterior} (${trecho(c.anterior)}): *${formatBRL(anterior.total)}*\n\n` +
    descreverVariacao(atual.total, anterior.total);

  const categorias = new Set([...atual.porCategoria.keys(), ...anterior.porCategoria.keys()]);
  const variacoes = [...categorias]
    .map((nome) => ({ nome, delta: (atual.porCategoria.get(nome) ?? 0) - (anterior.porCategoria.get(nome) ?? 0) }))
    .filter((v) => Math.abs(v.delta) >= 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
  if (variacoes.length > 0) {
    texto +=
      "\n\n🔎 *O que mais mudou*\n" +
      variacoes.map((v) => `• ${v.nome}: ${v.delta > 0 ? "+" : "-"}${formatBRL(Math.abs(v.delta))}`).join("\n");
  }
  await sendText(to, texto);
}

// ---------------------------------------------------------- contas a pagar

export async function responderContasAPagar(to: string): Promise<void> {
  const supabase = createAdminClient();
  const contas = await lerTudo((de, ate) =>
    supabase
      .from("contas_a_pagar")
      .select("descricao, valor, data_vencimento")
      .eq("status", "pendente")
      .is("deleted_at", null)
      .order("data_vencimento")
      .range(de, ate)
  );

  if (contas.length === 0) {
    await sendText(to, "✅ Nenhuma conta a pagar pendente no momento.");
    return;
  }

  const hoje = hojeNoBrasil();
  const em7 = new Date(`${hoje}T00:00:00Z`);
  em7.setUTCDate(em7.getUTCDate() + 7);
  const limite7 = em7.toISOString().slice(0, 10);

  const soma = (lista: typeof contas) => lista.reduce((s, c) => s + c.valor, 0);
  const vencidas = contas.filter((c) => c.data_vencimento < hoje);
  const proximas = contas.filter((c) => c.data_vencimento >= hoje && c.data_vencimento <= limite7);

  let texto =
    `💳 *Contas a pagar*\n` +
    `Total pendente: *${formatBRL(soma(contas))}* (${contas.length} conta${contas.length === 1 ? "" : "s"})\n` +
    (vencidas.length > 0 ? `🔴 Vencidas: ${formatBRL(soma(vencidas))} (${vencidas.length})\n` : "") +
    `🟡 Vencem nos próximos 7 dias: ${formatBRL(soma(proximas))} (${proximas.length})`;

  const lista = contas.slice(0, 8);
  texto +=
    "\n\n📅 *Próximas*\n" +
    lista
      .map((c) => `• ${dataCurta(c.data_vencimento)}${c.data_vencimento < hoje ? " ⚠️" : ""} · ${c.descricao} — ${formatBRL(c.valor)}`)
      .join("\n");
  if (contas.length > lista.length) texto += `\n… e mais ${contas.length - lista.length}.`;
  await sendText(to, texto);
}
