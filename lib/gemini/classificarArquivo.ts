import { chamarGemini } from "@/lib/gemini/chamarGemini";
import { TIPOS_SUGERIDOS, ehArea, type AreaArquivo } from "@/lib/arquivos/tipos";

const GEMINI_ARQUIVO_MS = 30_000;
// Acima disso o arquivo nao vai inline pro Gemini: classifica so pela legenda e pelo nome.
const LIMITE_INLINE_BYTES = 12 * 1024 * 1024;

export type LeituraArquivo = {
  /** "conta" = boleto/nota/comprovante de pagamento (fluxo de despesa); "documento" = pra guardar. */
  categoria: "conta" | "documento" | "incerto";
  area: AreaArquivo | null;
  tipo: string | null;
  /** Nome de uma obra da lista, quando o documento ou a legenda citam uma. */
  obraNome: string | null;
  /** Nome da licitacao (ex: "Concorrência 04/2026") ou pasta livre. */
  pasta: string | null;
  /** Tudo que identifica o documento (numeros, nomes, enderecos, datas...), pra busca. */
  textoBusca: string | null;
  /** Titulo curto do documento. */
  nome: string | null;
  /** AAAA-MM-DD - so quando o documento mostra uma validade/vencimento. */
  validade: string | null;
  resumo: string | null;
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    categoria: { type: "string", enum: ["conta", "documento", "incerto"] },
    area: { type: "string", enum: ["obra", "licitacao", "empresa", "pessoal"], nullable: true },
    tipo: { type: "string", nullable: true },
    obraNome: { type: "string", nullable: true },
    pasta: { type: "string", nullable: true },
    nome: { type: "string", nullable: true },
    validade: { type: "string", nullable: true },
    resumo: { type: "string", nullable: true },
    textoBusca: { type: "string", nullable: true },
  },
  required: ["categoria"],
};

function montarPrompt(entrada: { legenda?: string | null; nomeArquivo?: string | null; obras: string[]; hoje: string }): string {
  const tipos = (Object.keys(TIPOS_SUGERIDOS) as AreaArquivo[])
    .map((a) => `  - ${a}: ${TIPOS_SUGERIDOS[a].join(", ")}`)
    .join("\n");

  return `Você organiza os arquivos de uma construtora/incorporadora. Chegou este arquivo pelo WhatsApp do dono.
${entrada.legenda ? `Legenda que o dono escreveu: "${entrada.legenda}"\n` : ""}${entrada.nomeArquivo ? `Nome do arquivo: "${entrada.nomeArquivo}"\n` : ""}Hoje é ${entrada.hoje}.

Obras cadastradas: ${entrada.obras.length ? entrada.obras.join("; ") : "(nenhuma)"}

1) "categoria":
 - "conta": boleto, nota fiscal, cupom, fatura, recibo ou comprovante de pagamento/Pix (coisa que vira despesa).
 - "documento": documento pra GUARDAR: matrícula, escritura, alvará, certidão, contrato, edital, projeto/planta, ART, registro, CNH/RG, procuração, ata etc.
 - "incerto": não dá pra saber.
2) Se for "documento":
 - "area": "obra" (documento de um terreno/obra/empreendimento), "licitacao" (edital, proposta, habilitação ou certidão de uma licitação), "empresa" (documentos da empresa em si: contrato social, certidões da empresa) ou "pessoal" (documentos pessoais ou da casa do dono, ex: orçamento para o quarto dele; se a legenda disser que é pessoal, "meu", "minha casa" etc., use "pessoal").
 - "tipo", preferindo um destes por área:
${tipos}
 - "obraNome": o nome da obra/empreendimento/projeto a que o documento pertence, se a legenda ou o documento citarem (ex: "Villa Borghese"). Se for uma das obras cadastradas, devolva EXATAMENTE o nome da lista; se não estiver na lista, devolva o nome como foi citado. Nunca invente.
 - "pasta": só para "licitacao" (ex: "Concorrência 04/2026", "Pregão 12/2026") quando citada; senão null.
 - "nome": título curto e claro, no máximo 8 palavras (ex: "Matrícula do lote 12", "Alvará de construção").
 - "validade": AAAA-MM-DD, SOMENTE se o documento mostra data de validade/vencimento (certidões, alvarás, CNH). Matrícula e escritura NÃO vencem: null. Nunca invente.
 - "resumo": uma frase curta (até 20 palavras) dizendo o que é, sem dados sensíveis (sem CPF/RG completos).
 - "textoBusca": o MÁXIMO de informações do documento que ajudem a achá-lo depois, numa lista corrida separada por vírgulas ou ponto e vírgula, até 1200 caracteres: tipo do documento, números de identificação (matrícula, processo, protocolo, ART, CNPJ, número do edital), nomes de pessoas e empresas (proprietários, requerentes, responsável técnico, órgão emissor), cartório/prefeitura/comarca, município e estado, endereço, bairro, lote/quadra, áreas e medidas, valores, datas importantes (emissão, validade) e palavras-chave do assunto. NÃO inclua CPF nem RG de pessoas. Escreva só o que está no documento.
Guias de tributos, taxas, multas e impostos (ISS, IPTU, DAM, DARF) são do tipo "Guias e taxas".
A legenda escrita pelo dono tem prioridade sobre o que você lê no documento (obra, tipo, área).
Se a legenda pedir para guardar/salvar/arquivar o arquivo (mesmo sendo um orçamento, nota ou lista de preços), a categoria é "documento": orçamento vai no tipo "Orçamentos".
Se for "conta", deixe os demais campos null.

Responda APENAS com o JSON.`;
}

export async function classificarArquivo(entrada: {
  buffer?: Buffer | null;
  mimeType: string;
  legenda?: string | null;
  nomeArquivo?: string | null;
  obras: string[];
  hoje: string;
}): Promise<LeituraArquivo | null> {
  const podeLer =
    entrada.buffer &&
    entrada.buffer.length <= LIMITE_INLINE_BYTES &&
    (entrada.mimeType === "application/pdf" || entrada.mimeType.startsWith("image/"));

  const partes: Record<string, unknown>[] = [{ text: montarPrompt(entrada) }];
  if (podeLer && entrada.buffer) {
    partes.push({ inline_data: { mime_type: entrada.mimeType, data: entrada.buffer.toString("base64") } });
  }

  try {
    const res = await chamarGemini(
      {
        contents: [{ parts: partes }],
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      },
      { orcamentoMs: GEMINI_ARQUIVO_MS, contexto: "classificar arquivo" }
    );
    const data = await res.json();
    const texto: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) return null;
    const bruto = JSON.parse(texto) as Partial<LeituraArquivo>;
    return {
      categoria: bruto.categoria === "conta" || bruto.categoria === "documento" ? bruto.categoria : "incerto",
      area: bruto.area && ehArea(bruto.area) ? bruto.area : null,
      tipo: bruto.tipo?.trim().slice(0, 60) || null,
      obraNome: bruto.obraNome?.trim() || null,
      pasta: bruto.pasta?.trim().slice(0, 80) || null,
      nome: bruto.nome?.trim().slice(0, 80) || null,
      validade: bruto.validade && /^\d{4}-\d{2}-\d{2}$/.test(bruto.validade) ? bruto.validade : null,
      resumo: bruto.resumo?.trim().slice(0, 200) || null,
      textoBusca: bruto.textoBusca?.trim().slice(0, 2000) || null,
    };
  } catch (error) {
    console.error("Erro ao classificar arquivo:", error);
    return null;
  }
}
