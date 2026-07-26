import * as XLSX from "xlsx";

const MAX_CHARS_POR_PLANILHA = 12000;
const MAX_CHARS_TOTAL = 40000;

/**
 * Converte um arquivo .xlsx/.xls em texto (CSV por aba), para que a IA
 * consiga interpretar o layout, ja que planilhas de orcamento variam
 * bastante de engenheiro para engenheiro.
 */
export function extractSpreadsheetAsText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const blocos: string[] = [];
  let totalChars = 0;

  for (const nomeAba of workbook.SheetNames) {
    if (totalChars >= MAX_CHARS_TOTAL) break;

    const planilha = workbook.Sheets[nomeAba];
    let csv = XLSX.utils.sheet_to_csv(planilha, { blankrows: false });
    if (csv.length > MAX_CHARS_POR_PLANILHA) {
      csv = csv.slice(0, MAX_CHARS_POR_PLANILHA);
    }

    const bloco = `--- Aba: ${nomeAba} ---\n${csv}`;
    blocos.push(bloco);
    totalChars += bloco.length;
  }

  return blocos.join("\n\n");
}
