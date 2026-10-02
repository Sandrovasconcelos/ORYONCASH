import { ICONES_MATERIAL, type IconeMaterial } from "./materiais";
import { ICONES_ETAPA } from "./etapas";

export const TODOS_ICONES: Record<string, IconeMaterial> = { ...ICONES_MATERIAL, ...ICONES_ETAPA };

export function normalizarNome(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Ordem importa: a primeira regra que bate vence (mais especificas antes).
const REGRAS: [RegExp, string][] = [
  [/\b\d+\W{0,2}\s*mes\b|\bmes\b.*\b(canteiro|alvenaria|reboco|revestimento|acabamento)/, "calendario"],
  [/internet|wifi|\bnet\b/, "internet"],
  [/conta de luz|energia|\bluz\b/, "luz"],
  [/conta de agua|\bagua\b|saneamento/, "agua"],
  [/refeicao|almoco|marmita|lanche|alimenta/, "refeicao"],
  [/entulho|cacamba|descarte/, "entulho"],
  [/poco|perfuracao/, "poco"],
  [/legaliza|alvara|documento|licenca|projeto aprovado/, "documento"],
  [/corretagem|imovel|comissao/, "casa"],
  [/aluguel|administrativ|escritorio|\bsala\b/, "predio"],
  [/finaliza|conclusao|encerramento/, "bandeira"],
  [/entrega/, "chave"],
  [/admira|visita/, "olho"],
  [/locacao|compra de equip|equipamento|betoneira|andaime/, "betoneira"],
  [/mao de obra|pedreiro|servente|ajudante|\bepi\b|luva|capacete|camisa/, "maoDeObra"],
  [/topograf/, "topografia"],
  [/terraplen|aterro|escavac/, "terraplenagem"],
  [/radier|\blaje\b|laje/, "laje"],
  [/fundac|infra.?estrutura|sapata|estaca|baldrame/, "fundacao"],
  [/supra.?estrutura|estrutura|pilar|\bviga\b|coluna|trelica|mobilizacao.*estrutura/, "estrutura"],
  [/servicos preliminares|canteiro|mobilizacao|tapume/, "canteiro"],
  [/impermeabil|manta|vedacit|asfalt/, "manta"],
  [/drenagem|dreno/, "drenagem"],
  [/louca|metais|torneira|sifao|valvula|registro|vaso/, "loucas"],
  [/hidr|esgoto|tubo|cano|conexo|conduite|eletroduto|\btee\b|joelho|curva|sold /, "hidraulico"],
  [/eletric|\bcabo|\bfio\b|disjuntor|tomada|interrup|plug|fita isolante|caixa luz|mecanismo/, "eletrico"],
  [/piscina/, "piscina"],
  [/esquadria|janela|vidro|espelho|dobradica|ferragem|fechadura/, "esquadria"],
  [/cobertura|telhado|telha/, "cobertura"],
  [/revestimento|azulejo|ceramica de parede|reboco/, "revestimento"],
  [/piso|pavimenta|porcelanato|rejunte|espacador/, "piso"],
  [/pintura|tinta|extralatex|corante|thinner|spray|broxa|rolo|massa acrilica|selador/, "pintura"],
  [/limpeza/, "limpeza"],
  [/cimento|argamassa|concreto|aditivo/, "cimento"],
  [/tijolo|alvenaria|bloco/, "tijolo"],
  [/areia/, "areia"],
  [/brita|pedra|seixo|cascalho/, "brita"],
  [/vergalh|ferro|arame|tela\b|barra|aco\b|malha|corrente|trilho/, "ferro"],
  [/madeira|tabua|barrote|compensado|mdf|massaranduba|pinus/, "madeira"],
  [/parafuso|prego|bucha|veda rosca/, "parafuso"],
  [/broca|serra|bits|furadeira/, "broca"],
  [/disco|lixa/, "disco"],
  [/desemp|gesso|massa|espatula|colher de pedreiro/, "massa"],
  [/martelo|ferramenta|marreta|enxada/, "martelo"],
  [/balde|carrinho|carro de mao|refletor/, "martelo"],
  [/\besm\b|esmalt|alvorada|santorini/, "piso"],
  [/caixa sif|grelha|ralo/, "hidraulico"],
  [/placa cega|acabamento aspen|aspen/, "eletrico"],
  [/espuma|adesivo|cola\b|silicone/, "massa"],
  [/^material$|materiais/, "tijolo"],
  [/servicos complementares|servicos/, "servicos"],
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

/** Primeiro texto que tiver um icone especifico (ex: material, depois etapa, depois categoria). */
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
