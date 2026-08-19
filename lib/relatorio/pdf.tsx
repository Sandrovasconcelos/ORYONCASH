import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatBRL } from "@/lib/conversation/format";
import type { DadosRelatorio } from "./dados";

const PRETO = "#111317";
const VERMELHO = "#e11b22";
const CINZA_500 = "#6b7280";
const CINZA_300 = "#d1d5db";
const CINZA_100 = "#f3f4f6";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: PRETO, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: PRETO,
    padding: 16,
    borderRadius: 6,
    marginBottom: 16,
  },
  headerBrand: { color: "#ffffff", fontSize: 14, fontFamily: "Helvetica-Bold" },
  headerSub: { color: "#ffffff99", fontSize: 7, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
  headerTitle: { color: "#ffffff", fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  headerGerado: { color: "#ffffff99", fontSize: 7, marginTop: 2, textAlign: "right" },
  filtrosRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  filtroChip: {
    backgroundColor: CINZA_100,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 7.5,
    color: PRETO,
  },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: CINZA_300, borderRadius: 6, padding: 8 },
  kpiLabel: { fontSize: 6.5, color: CINZA_500, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValor: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 3 },
  kpiValorDestaque: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 3, color: VERMELHO },
  breakdownRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  breakdownCard: { flex: 1, borderWidth: 1, borderColor: CINZA_300, borderRadius: 6, padding: 10 },
  breakdownTitulo: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  breakdownItem: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4, fontSize: 7.5 },
  table: { borderWidth: 1, borderColor: CINZA_300, borderRadius: 4, overflow: "hidden" },
  tableHeadRow: { flexDirection: "row", backgroundColor: PRETO, paddingVertical: 5 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: CINZA_300,
  },
  tableFootRow: { flexDirection: "row", paddingVertical: 6, borderTopWidth: 1, borderTopColor: PRETO },
  th: { color: "#ffffff", fontSize: 7, fontFamily: "Helvetica-Bold", paddingHorizontal: 4 },
  td: { fontSize: 7.5, paddingHorizontal: 4 },
  tdValor: { fontSize: 7.5, paddingHorizontal: 4, textAlign: "right", fontFamily: "Helvetica-Bold" },
  rodape: { marginTop: 14, fontSize: 7, color: CINZA_500, textAlign: "center" },
});

const COLS = {
  data: 0.09,
  obra: 0.13,
  categoria: 0.12,
  etapa: 0.12,
  fornecedor: 0.13,
  descricao: 0.26,
  valor: 0.15,
};

function RelatorioDocument({ dados, geradoEm }: { dados: DadosRelatorio; geradoEm: string }) {
  const maiorCategoria = Math.max(0, ...dados.porCategoria.map((c) => c.total));
  const maiorEtapa = Math.max(0, ...dados.porEtapa.map((c) => c.total));

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerBrand}>OryonCash</Text>
            <Text style={styles.headerSub}>Controle financeiro de obras</Text>
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
          <View style={styles.kpiCard}>
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
              dados.porCategoria.map((item) => (
                <View key={item.nome} style={styles.breakdownItem}>
                  <Text style={{ color: item.total === maiorCategoria ? VERMELHO : PRETO }}>{item.nome}</Text>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatBRL(item.total)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 7.5, color: CINZA_500 }}>Nenhum registro.</Text>
            )}
          </View>
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitulo}>Gasto por etapa</Text>
            {dados.porEtapa.length > 0 ? (
              dados.porEtapa.map((item) => (
                <View key={item.nome} style={styles.breakdownItem}>
                  <Text style={{ color: item.total === maiorEtapa ? VERMELHO : PRETO }}>{item.nome}</Text>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{formatBRL(item.total)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 7.5, color: CINZA_500 }}>Nenhum registro.</Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.th, { width: `${COLS.data * 100}%` }]}>Data</Text>
            <Text style={[styles.th, { width: `${COLS.obra * 100}%` }]}>Obra</Text>
            <Text style={[styles.th, { width: `${COLS.categoria * 100}%` }]}>Categoria</Text>
            <Text style={[styles.th, { width: `${COLS.etapa * 100}%` }]}>Etapa</Text>
            <Text style={[styles.th, { width: `${COLS.fornecedor * 100}%` }]}>Fornecedor</Text>
            <Text style={[styles.th, { width: `${COLS.descricao * 100}%` }]}>Descrição</Text>
            <Text style={[styles.th, { width: `${COLS.valor * 100}%`, textAlign: "right" }]}>Valor</Text>
          </View>

          {dados.despesas.map((d) => (
            <View key={d.id} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, { width: `${COLS.data * 100}%` }]}>{d.data.split("-").reverse().join("/")}</Text>
              <Text style={[styles.td, { width: `${COLS.obra * 100}%` }]}>{d.obraNome}</Text>
              <Text style={[styles.td, { width: `${COLS.categoria * 100}%` }]}>{d.categoriaNome}</Text>
              <Text style={[styles.td, { width: `${COLS.etapa * 100}%` }]}>{d.etapaNome}</Text>
              <Text style={[styles.td, { width: `${COLS.fornecedor * 100}%` }]}>{d.fornecedorNome}</Text>
              <Text style={[styles.td, { width: `${COLS.descricao * 100}%` }]}>{d.descricao ?? "-"}</Text>
              <Text style={[styles.tdValor, { width: `${COLS.valor * 100}%` }]}>{formatBRL(d.valor)}</Text>
            </View>
          ))}

          {dados.despesas.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.td, { width: "100%", textAlign: "center", color: CINZA_500 }]}>
                Nenhuma despesa encontrada para os filtros selecionados.
              </Text>
            </View>
          )}

          {dados.despesas.length > 0 && (
            <View style={styles.tableFootRow}>
              <Text
                style={[
                  styles.td,
                  {
                    width: `${(COLS.data + COLS.obra + COLS.categoria + COLS.etapa + COLS.fornecedor + COLS.descricao) * 100}%`,
                    textAlign: "right",
                    fontFamily: "Helvetica-Bold",
                    textTransform: "uppercase",
                  },
                ]}
              >
                Total
              </Text>
              <Text style={[styles.tdValor, { width: `${COLS.valor * 100}%`, color: VERMELHO, fontSize: 9 }]}>
                {formatBRL(dados.totalGasto)}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.rodape}>
          Documento gerado automaticamente pelo OryonCash em {geradoEm}. Não substitui nota fiscal ou
          comprovante de pagamento.
        </Text>
      </Page>
    </Document>
  );
}

export async function gerarRelatorioPdfBuffer(dados: DadosRelatorio, geradoEm: string): Promise<Buffer> {
  return renderToBuffer(<RelatorioDocument dados={dados} geradoEm={geradoEm} />);
}
