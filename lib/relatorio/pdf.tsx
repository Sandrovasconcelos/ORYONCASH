import fs from "node:fs/promises";
import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Image, Link, renderToBuffer } from "@react-pdf/renderer";
import { formatBRL } from "@/lib/conversation/format";
import type { DadosRelatorio, DespesaRelatorio } from "./dados";

const PRETO = "#111317";
const VERMELHO = "#e11b22";
const CINZA_700 = "#374151";
const CINZA_500 = "#6b7280";
const CINZA_300 = "#d9dce1";
const CINZA_100 = "#f4f5f7";
const CINZA_ZEBRA = "#fafafb";
const BRANCO = "#ffffff";

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 42, paddingHorizontal: 30, fontSize: 9, color: PRETO, fontFamily: "Helvetica" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: PRETO,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginBottom: 18,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 34, height: 34 },
  headerBrand: { color: BRANCO, fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
  headerSub: { color: "#ffffffa0", fontSize: 7, marginTop: 2, textTransform: "uppercase", letterSpacing: 1.4 },
  headerTitle: { color: BRANCO, fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  headerGerado: { color: "#ffffffa0", fontSize: 7, marginTop: 3, textAlign: "right" },

  filtrosRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  filtroChip: {
    backgroundColor: CINZA_100,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
    fontSize: 7.5,
    color: CINZA_700,
  },

  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: CINZA_300,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  kpiCardDestaque: { borderTopWidth: 3, borderTopColor: VERMELHO },
  kpiLabel: { fontSize: 6.5, color: CINZA_500, textTransform: "uppercase", letterSpacing: 0.6 },
  kpiValor: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 4 },
  kpiValorDestaque: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 4, color: VERMELHO },

  breakdownRow: { flexDirection: "row", gap: 14, marginBottom: 18 },
  breakdownCard: { flex: 1, borderWidth: 1, borderColor: CINZA_300, borderRadius: 8, padding: 12 },
  breakdownTitulo: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: CINZA_700,
  },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 3.5,
    borderTopWidth: 1,
    borderTopColor: CINZA_100,
    fontSize: 8,
  },
  breakdownTrack: { height: 4, backgroundColor: CINZA_100, borderRadius: 2, marginTop: 3, marginBottom: 5 },
  breakdownFill: { height: 4, borderRadius: 2 },

  obraBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: CINZA_700,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 14,
    borderRadius: 4,
  },
  obraBarNome: { color: BRANCO, fontSize: 9, fontFamily: "Helvetica-Bold" },
  obraBarTotal: { color: BRANCO, fontSize: 9, fontFamily: "Helvetica-Bold" },

  table: { borderWidth: 1, borderColor: CINZA_300, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  tableHeadRow: { flexDirection: "row", backgroundColor: PRETO, paddingVertical: 6 },
  tableRow: { flexDirection: "row", paddingVertical: 5, borderTopWidth: 1, borderTopColor: CINZA_100 },
  tableRowZebra: { backgroundColor: CINZA_ZEBRA },
  tableFootRow: { flexDirection: "row", paddingVertical: 7, borderTopWidth: 1.5, borderTopColor: PRETO },
  th: {
    color: BRANCO,
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 5,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  td: { fontSize: 8, paddingHorizontal: 5, color: PRETO },
  tdMuted: { fontSize: 8, paddingHorizontal: 5, color: CINZA_500 },
  tdValor: { fontSize: 8, paddingHorizontal: 5, textAlign: "right", fontFamily: "Helvetica-Bold" },
  tdLink: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  tdLinkNota: { color: "#0369a1" },
  tdLinkComprovante: { color: "#047857" },
  tdSemDocumento: { fontSize: 7.5, color: CINZA_500 },

  rodape: { position: "absolute", bottom: 18, left: 30, right: 30, textAlign: "center" },
  rodapeTexto: { fontSize: 7, color: CINZA_500 },
  paginacao: {
    position: "absolute",
    bottom: 18,
    right: 30,
    fontSize: 7,
    color: CINZA_500,
  },
});

const COLS = {
  data: 0.06,
  categoria: 0.12,
  etapa: 0.12,
  fornecedor: 0.13,
  descricao: 0.19,
  qtd: 0.11,
  valor: 0.11,
  documentos: 0.16,
};

function agruparPorObra(despesas: DespesaRelatorio[]): { obraNome: string; total: number; itens: DespesaRelatorio[] }[] {
  const mapa = new Map<string, DespesaRelatorio[]>();
  for (const d of despesas) {
    const lista = mapa.get(d.obraNome) ?? [];
    lista.push(d);
    mapa.set(d.obraNome, lista);
  }
  return [...mapa.entries()]
    .map(([obraNome, itens]) => ({
      obraNome,
      total: itens.reduce((soma, i) => soma + i.valor, 0),
      itens,
    }))
    .sort((a, b) => b.total - a.total);
}

async function carregarLogoBase64(): Promise<string | null> {
  try {
    const caminho = path.join(process.cwd(), "public", "oryoncash-simbolo-oficial.png");
    const arquivo = await fs.readFile(caminho);
    return `data:image/png;base64,${arquivo.toString("base64")}`;
  } catch {
    return null;
  }
}

function RelatorioDocument({
  dados,
  geradoEm,
  logoBase64,
}: {
  dados: DadosRelatorio;
  geradoEm: string;
  logoBase64: string | null;
}) {
  const maiorCategoria = Math.max(0, ...dados.porCategoria.map((c) => c.total));
  const maiorEtapa = Math.max(0, ...dados.porEtapa.map((c) => c.total));
  const grupos = agruparPorObra(dados.despesas);
  const larguraDescritiva =
    (COLS.data + COLS.categoria + COLS.etapa + COLS.fornecedor + COLS.descricao + COLS.qtd) * 100;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img */}
            {logoBase64 && <Image src={logoBase64} style={styles.logo} />}
            <View>
              <Text style={styles.headerBrand}>OryonCash</Text>
              <Text style={styles.headerSub}>Controle financeiro de obras</Text>
            </View>
          </View>
          <View>
            <Text style={styles.headerTitle}>Relatório de Despesas</Text>
            <Text style={styles.headerGerado}>Gerado em {geradoEm}</Text>
          </View>
        </View>

        {dados.filtrosAtivos.length > 0 && (
          <View style={styles.filtrosRow}>
            {dados.filtrosAtivos.map((f) => (
              <Text key={f.rotulo} style={styles.filtroChip}>
                {f.rotulo}: {f.valor}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, styles.kpiCardDestaque]}>
            <Text style={styles.kpiLabel}>Total gasto</Text>
            <Text style={styles.kpiValorDestaque}>{formatBRL(dados.totalGasto)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Lançamentos</Text>
            <Text style={styles.kpiValor}>{dados.quantidade}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Ticket médio</Text>
            <Text style={styles.kpiValor}>{formatBRL(dados.ticketMedio)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Período</Text>
            <Text style={styles.kpiValor}>{dados.periodo}</Text>
          </View>
        </View>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitulo}>Gasto por categoria</Text>
            {dados.porCategoria.length > 0 ? (
              dados.porCategoria.map((item) => {
                const percentual = dados.totalGasto > 0 ? (item.total / dados.totalGasto) * 100 : 0;
                const destaque = item.total === maiorCategoria;
                return (
                  <View key={item.nome}>
                    <View style={styles.breakdownItem}>
                      <Text style={{ color: destaque ? VERMELHO : PRETO }}>{item.nome}</Text>
                      <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatBRL(item.total)}</Text>
                    </View>
                    <View style={styles.breakdownTrack}>
                      <View
                        style={[
                          styles.breakdownFill,
                          { width: `${Math.max(2, Math.min(100, percentual))}%`, backgroundColor: destaque ? VERMELHO : CINZA_700 },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={{ fontSize: 8, color: CINZA_500 }}>Nenhum registro.</Text>
            )}
          </View>
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitulo}>Gasto por etapa</Text>
            {dados.porEtapa.length > 0 ? (
              dados.porEtapa.map((item) => {
                const percentual = dados.totalGasto > 0 ? (item.total / dados.totalGasto) * 100 : 0;
                const destaque = item.total === maiorEtapa;
                return (
                  <View key={item.nome}>
                    <View style={styles.breakdownItem}>
                      <Text style={{ color: destaque ? VERMELHO : PRETO }}>{item.nome}</Text>
                      <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatBRL(item.total)}</Text>
                    </View>
                    <View style={styles.breakdownTrack}>
                      <View
                        style={[
                          styles.breakdownFill,
                          { width: `${Math.max(2, Math.min(100, percentual))}%`, backgroundColor: destaque ? VERMELHO : CINZA_700 },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={{ fontSize: 8, color: CINZA_500 }}>Nenhum registro.</Text>
            )}
          </View>
        </View>

        {grupos.map((grupo) => (
          <View key={grupo.obraNome}>
            <View style={styles.obraBar} wrap={false}>
              <Text style={styles.obraBarNome}>{grupo.obraNome}</Text>
              <Text style={styles.obraBarTotal}>{formatBRL(grupo.total)}</Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeadRow} fixed>
                <Text style={[styles.th, { width: `${COLS.data * 100}%` }]}>Data</Text>
                <Text style={[styles.th, { width: `${COLS.categoria * 100}%` }]}>Categoria</Text>
                <Text style={[styles.th, { width: `${COLS.etapa * 100}%` }]}>Etapa</Text>
                <Text style={[styles.th, { width: `${COLS.fornecedor * 100}%` }]}>Fornecedor</Text>
                <Text style={[styles.th, { width: `${COLS.descricao * 100}%` }]}>Descrição</Text>
                <Text style={[styles.th, { width: `${COLS.qtd * 100}%` }]}>Qtd</Text>
                <Text style={[styles.th, { width: `${COLS.valor * 100}%`, textAlign: "right" }]}>Valor</Text>
                <Text style={[styles.th, { width: `${COLS.documentos * 100}%` }]}>Documentos</Text>
              </View>

              {grupo.itens.map((d, indice) => (
                <View
                  key={d.id}
                  style={[styles.tableRow, ...(indice % 2 === 1 ? [styles.tableRowZebra] : [])]}
                  wrap={false}
                >
                  <Text style={[styles.tdMuted, { width: `${COLS.data * 100}%` }]}>
                    {d.data.split("-").reverse().join("/")}
                  </Text>
                  <Text style={[styles.td, { width: `${COLS.categoria * 100}%` }]}>{d.categoriaNome}</Text>
                  <Text style={[styles.td, { width: `${COLS.etapa * 100}%` }]}>{d.etapaNome}</Text>
                  <Text style={[styles.td, { width: `${COLS.fornecedor * 100}%` }]}>{d.fornecedorNome}</Text>
                  <Text style={[styles.td, { width: `${COLS.descricao * 100}%` }]}>{d.descricao ?? "-"}</Text>
                  <Text style={[styles.tdMuted, { width: `${COLS.qtd * 100}%` }]}>
                    {d.quantidade != null
                      ? `${d.quantidade}${d.valorUnitario != null ? ` × ${formatBRL(d.valorUnitario)}` : ""}`
                      : "-"}
                  </Text>
                  <Text style={[styles.tdValor, { width: `${COLS.valor * 100}%` }]}>{formatBRL(d.valor)}</Text>
                  <View style={{ width: `${COLS.documentos * 100}%`, paddingHorizontal: 5, flexDirection: "row", gap: 6 }}>
                    {d.notaUrl && (
                      <Link src={d.notaUrl} style={[styles.tdLink, styles.tdLinkNota]}>
                        Nota
                      </Link>
                    )}
                    {d.comprovanteUrl && (
                      <Link src={d.comprovanteUrl} style={[styles.tdLink, styles.tdLinkComprovante]}>
                        Comprov.
                      </Link>
                    )}
                    {!d.notaUrl && !d.comprovanteUrl && <Text style={styles.tdSemDocumento}>-</Text>}
                  </View>
                </View>
              ))}

              <View style={styles.tableFootRow} wrap={false}>
                <Text
                  style={[
                    styles.td,
                    {
                      width: `${larguraDescritiva}%`,
                      textAlign: "right",
                      fontFamily: "Helvetica-Bold",
                      textTransform: "uppercase",
                      fontSize: 7,
                      color: CINZA_700,
                    },
                  ]}
                >
                  Subtotal {grupo.obraNome}
                </Text>
                <Text style={[styles.tdValor, { width: `${COLS.valor * 100}%`, color: VERMELHO, fontSize: 9 }]}>
                  {formatBRL(grupo.total)}
                </Text>
                <View style={{ width: `${COLS.documentos * 100}%` }} />
              </View>
            </View>
          </View>
        ))}

        {dados.despesas.length === 0 && (
          <View style={[styles.table, { paddingVertical: 24 }]}>
            <Text style={{ textAlign: "center", color: CINZA_500, fontSize: 9 }}>
              Nenhuma despesa encontrada para os filtros selecionados.
            </Text>
          </View>
        )}

        {dados.despesas.length > 0 && (
          <View style={[styles.obraBar, { backgroundColor: PRETO, marginTop: 16 }]} wrap={false}>
            <Text style={[styles.obraBarNome, { textTransform: "uppercase", letterSpacing: 0.5 }]}>
              Total geral
            </Text>
            <Text style={[styles.obraBarTotal, { fontSize: 11 }]}>{formatBRL(dados.totalGasto)}</Text>
          </View>
        )}

        <View style={styles.rodape} fixed>
          <Text style={styles.rodapeTexto}>
            Documento gerado automaticamente pelo OryonCash em {geradoEm}. Não substitui nota fiscal ou
            comprovante de pagamento.
          </Text>
        </View>
        <Text
          style={styles.paginacao}
          fixed
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export async function gerarRelatorioPdfBuffer(dados: DadosRelatorio, geradoEm: string): Promise<Buffer> {
  const logoBase64 = await carregarLogoBase64();
  return renderToBuffer(<RelatorioDocument dados={dados} geradoEm={geradoEm} logoBase64={logoBase64} />);
}
