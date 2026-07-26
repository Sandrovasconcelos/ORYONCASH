export const ESTADOS = {
  MENU: "menu",

  DESPESA_VALOR: "despesa_valor",
  DESPESA_OBRA: "despesa_obra",
  DESPESA_CATEGORIA: "despesa_categoria",
  DESPESA_ETAPA: "despesa_etapa",
  DESPESA_DESCRICAO_PROMPT: "despesa_descricao_prompt",
  DESPESA_DESCRICAO_TEXTO: "despesa_descricao_texto",
  DESPESA_CONFIRMACAO: "despesa_confirmacao",

  CADASTRO_OBRA_NOME: "cadastro_obra_nome",
  CADASTRO_OBRA_ORCAMENTO: "cadastro_obra_orcamento",

  CADASTRO_MATERIAL_NOME: "cadastro_material_nome",
  CADASTRO_MATERIAL_CATEGORIA: "cadastro_material_categoria",

  CADASTRO_FORNECEDOR_NOME: "cadastro_fornecedor_nome",
  CADASTRO_FORNECEDOR_CONTATO: "cadastro_fornecedor_contato",

  RESUMO_OBRA: "resumo_obra",

  NOTA_AGUARDANDO_OBRA: "nota_aguardando_obra",
  NOTA_AGUARDANDO_ETAPA: "nota_aguardando_etapa",
  NOTA_CONFIRMACAO: "nota_confirmacao",

  ORCAMENTO_AGUARDANDO_OBRA: "orcamento_aguardando_obra",
  ORCAMENTO_CONFIRMACAO: "orcamento_confirmacao",

  CORRIGIR_SELECIONANDO_LANCAMENTO: "corrigir_selecionando_lancamento",
  CORRIGIR_SELECIONANDO_CAMPO: "corrigir_selecionando_campo",
  CORRIGIR_VALOR_NOVO: "corrigir_valor_novo",
  CORRIGIR_DESCRICAO_NOVA: "corrigir_descricao_nova",
  CORRIGIR_CATEGORIA_NOVA: "corrigir_categoria_nova",
  CORRIGIR_ETAPA_NOVA: "corrigir_etapa_nova",
  CORRIGIR_FORNECEDOR_NOVO: "corrigir_fornecedor_novo",
  CORRIGIR_CONFIRMAR_EXCLUSAO: "corrigir_confirmar_exclusao",

  REMOVER_TIPO: "remover_tipo",
  REMOVER_SELECIONANDO_ITEM: "remover_selecionando_item",
  REMOVER_CONFIRMACAO: "remover_confirmacao",
} as const;

export const MENU_IDS = {
  REGISTRAR_DESPESA: "menu:registrar_despesa",
  CADASTRAR_OBRA: "menu:cadastrar_obra",
  CADASTRAR_MATERIAL: "menu:cadastrar_material",
  CADASTRAR_FORNECEDOR: "menu:cadastrar_fornecedor",
  VER_RESUMO: "menu:ver_resumo",
  CORRIGIR_LANCAMENTO: "menu:corrigir_lancamento",
  REMOVER_CADASTRO: "menu:remover_cadastro",
} as const;

export const TIPO_REMOVER_IDS = {
  OBRA: "tipo:obra",
  MATERIAL: "tipo:material",
  FORNECEDOR: "tipo:fornecedor",
} as const;

export const CAMPO_IDS = {
  VALOR: "campo:valor",
  CATEGORIA: "campo:categoria",
  ETAPA: "campo:etapa",
  FORNECEDOR: "campo:fornecedor",
  DESCRICAO: "campo:descricao",
  EXCLUIR: "campo:excluir",
} as const;

export const COMANDOS_CANCELAR = ["menu", "cancelar", "sair"];
