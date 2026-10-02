import { ICONES_MATERIAL, type IconeMaterial } from "./materiais";
import { ICONES_ETAPA, ICONES_ITEM } from "./etapas";

export const TODOS_ICONES: Record<string, IconeMaterial> = { ...ICONES_MATERIAL, ...ICONES_ETAPA, ...ICONES_ITEM };

export function normalizarNome(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Ordem importa: vence a primeira regra que bate. Por isso vem primeiro o que
// o item E (ferramenta, EPI, peca especifica) e so depois o material de que
// e feito ("trena de aco" e trena, nao vergalhao) ou o assunto geral.
const REGRAS: [RegExp, string][] = [
  // --- contas e pagamentos com assunto proprio ---
  [/\binternet\b|\bwifi\b|fibra/, "internet"],
  [/caixa luz|\bmecanismo|\bplug|\bplugue|interrup|tomada|disjuntor|fita isolante|placa cega|acabamento aspen|\baspen\b|\bcabo\b|\bfio\b|eletric|chuveiro|cabos/, "eletrico"],
  [/lampada|luminaria|refletor|\bled\b|iluminacao/, "lampada"],
  [/conta de (luz|energia)|\benergia\b|equatorial|^luz\b|\bluz \d/, "luz"],
  [/conta de agua|^agua\b|\bagua pra|saneamento/, "agua"],
  [/refeicao|almoco|marmita|lanche|galeto/, "refeicao"],
  [/entulho|cacamba/, "entulho"],
  [/\brrt\b|\bret\b|responsabilidade tecnica/, "documento"],
  [/itbi|iptu|imposto|taxa|alvara|matricula|legaliza|licenca|documento|contrato|cartorio/, "documento"],
  [/contabilidade|contador/, "calculadora"],
  [/marketing|trafego|publicidade|anuncio|gravacao|\bolx\b/, "megafone"],
  [/camera|vigilancia/, "camera"],
  [/impressao|plotagem|papelaria|\bcopia/, "impressora"],
  [/combustivel|gasolina|diesel|etanol/, "combustivel"],
  [/cadeado|fechadura/, "cadeado"],

  // --- ferramentas e pecas (antes dos materiais) ---
  [/limpeza|faxina|diarista|vassoura/, "limpeza"],
  [/trena|metro articulado/, "trena"],
  [/chave allen|chave teste|cunha |lapis carpinteiro|desengripante|camara de ar|nivelamento/, "martelo"],
  [/linha pedreiro|linha de pedreiro|prumo|esquadro/, "linha"],
  [/disco|lixa|esmeril/, "disco"],
  [/\bserra\b|serrote|arco de serra/, "serra"],
  [/broca|\bbits?\b|furadeira|martelete|parafusadeira/, "broca"],
  [/\bbota|botina|\bsapato|calcado|perneira/, "bota"],
  [/\bluva\b(?!.*(esgoto|sold|correr|\d+ ?mm))|\bluvas\b/, "luva"],
  [/capacete|\bepi\b|fardamento|uniforme|camisa|oculos de protecao|protetor auricular|colete/, "maoDeObra"],
  [/martelo|marreta|talhadeira|picareta|alviao|torques|chave de|chave dobrar|alicate|enxada|\bpa\b|colher de pedreiro|ferramenta/, "martelo"],
  [/desemp|espatula|gesso|massa corrida|massa acrilica|rejunte|adesivo|\bcola\b|silicone|espuma/, "massa"],
  [/broxa|\brolo\b|pincel|tinta|extralatex|corante|thinner|spray|selador|verniz|\bpintura\b|esmalte/, "pintura"],
  [/parafuso|prego|\bbucha\b|\bparaf\b|veda rosca|arruela|\bporca\b/, "parafuso"],
  [/balde|carrinho|carro de mao|\blona\b|escora|andaime/, "betoneira"],

  // --- materiais de construcao ---
  [/esgoto|\bsold\b|tubo|\bcano\b|conexo|conduite|eletroduto|\btee\b|joelho|\bcurva\b|caixa sif|grelha|ralo|hidrossanit|hidraul|rosc plug/, "hidraulico"],
  [/louca|metais|torneira|sifao|valvula|registro|lavatorio|\bpia\b|vaso sanitario/, "loucas"],
  [/dobradica|trinco|ferragem|\bporta\b|esquadria|janela|vidro|espelho/, "esquadria"],
  [/vergalh|arame|\btela\b|malha|treli|\bcoluna\b|barra (de )?ferro|\bferro\b|corrente|trilho|\baco\b/, "ferro"],
  [/(^|\W)cimento|argamassa|concreto|concretagem|aditivo|vedacit/, "cimento"],
  [/tijolo|alvenaria|\bbloco\b|blocos/, "tijolo"],
  [/(^|\W)areia/, "areia"],
  [/brita|pedra|seixo|cascalho/, "brita"],
  [/madeira|tabua|barrote|compensado|\bmdf\b|massaranduba|pinus|\bdeck\b/, "madeira"],
  [/manta|impermeabil|asfalt/, "manta"],
  [/\besm\b|esmalt|porcelanato|\bpiso|pavimenta|espacador|alvorada|santorini/, "piso"],
  [/revestimento|azulejo|reboco|ceramica de parede/, "revestimento"],
  [/cobertura|telhado|telha/, "cobertura"],
  [/terraplen|terraplan|aterro|escavac|retroescavadeira/, "terraplenagem"],
  [/piscina/, "piscina"],
  [/radier|\blaje\b|\blajes\b/, "laje"],
  [/fundac|infra.?estrutura|sapata|estaca|baldrame/, "fundacao"],
  [/supra.?estrutura|estrutura|pilar|\bviga\b/, "estrutura"],
  [/topograf/, "topografia"],
  [/drenagem|dreno/, "drenagem"],
  [/servicos preliminares|canteiro|mobilizacao|tapume|container|conteiner/, "canteiro"],
  [/poco|perfuracao/, "poco"],

  // --- categorias e assuntos gerais ---
  [/\b\d+\W{0,2}\s*mes\b|\bmes\b.*\b(canteiro|alvenaria|reboco|revestimento|acabamento)/, "calendario"],
  [/finaliza|conclusao|encerramento/, "bandeira"],
  [/entrega/, "chave"],
  [/admira|visita/, "olho"],
  [/corretagem|imovel|comissao/, "casa"],
  [/aluguel|administrativ|escritorio|\bsala\b/, "predio"],
  [/locacao|compra de equip|equipamento|betoneira|vibrador/, "betoneira"],
  [/mao de obra|pedreiro|servente|ajudante|diaria|eletricista|encanador|pintor/, "maoDeObra"],
  [/\bpix\b|transferencia|pagamento|boleto|\bted\b/, "pix"],
  [/^material$|materiais/, "tijolo"],
  [/servicos complementares|servicos|\bfrete\b|taxista|transporte|administracao/, "servicos"],
];

/**
 * Escolhe a chave do icone pelo nome (de categoria, etapa ou material),
 * sem depender de banco - qualquer item novo ja ganha um icone na hora.
 * Retorna "generico" quando nenhuma regra serve (ai a IA pode desenhar um
 * proprio, ver lib/icones/gerar.ts).
 */
export function chaveIconePorNome(nome: string | null | undefined): string {
  if (!nome) return "generico";
  const t = normalizarNome(nome);
  for (const [regra, chave] of REGRAS) {
    if (regra.test(t)) return chave;
  }
  return "generico";
}

/** Primeiro texto que tiver um icone especifico (ex: material, depois descricao, depois categoria). */
export function chaveIconeDe(...nomes: (string | null | undefined)[]): string {
  for (const nome of nomes) {
    const chave = chaveIconePorNome(nome);
    if (chave !== "generico") return chave;
  }
  return "generico";
}

export function svgDoIcone(chave: string): string {
  return (TODOS_ICONES[chave] ?? TODOS_ICONES.generico).svg;
}

export function rotuloDoIcone(chave: string): string {
  return (TODOS_ICONES[chave] ?? TODOS_ICONES.generico).rotulo;
}
