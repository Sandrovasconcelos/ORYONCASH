import * as Sentry from "@sentry/nextjs";
import type { IncomingMessage, IncomingMedia } from "@/lib/whatsapp/parse";
import { sendText, sendButtons } from "@/lib/whatsapp/messages";
import { getSession, saveSession, resetSession, type Session } from "@/lib/whatsapp/session";
import { downloadWhatsAppMedia } from "@/lib/whatsapp/media";
import { extractInvoiceData, type InvoiceItem, type InvoiceData } from "@/lib/gemini/extractInvoice";
import { extractOrcamentoData, type OrcamentoEtapa } from "@/lib/gemini/extractOrcamento";
import { extractDespesaDeAudio } from "@/lib/gemini/extractDespesaAudio";
import { extractSpreadsheetAsText } from "@/lib/orcamento/parseSpreadsheet";
import { formatBRL, parseValorBR } from "./format";
import { ESTADOS, MENU_IDS, CAMPO_IDS, TIPO_REMOVER_IDS, COMANDOS_CANCELAR, RECORRENCIA_IDS } from "./states";
import { sendMenuPrincipal } from "./menu";
import { sendListPeriodoRelatorio, gerarEEnviarRelatorio } from "./relatorio";
import {
  sendListObras,
  sendListCategorias,
  sendListEtapas,
  sendListFornecedores,
  sendListDespesasRecentes,
  sendListDespesasBusca,
  sendListCamposParaCorrigir,
  sendListMateriais,
  sendListMateriaisParaDespesa,
  sendListObrasParaRelatorio,
  sendListObrasParaContaAPagar,
  sendButtonsRecorrencia,
  sendListDiasAviso,
} from "./lists";
import {
  findObraById,
  findObraPorTexto,
  findCategoriaById,
  findCategoriaPorTexto,
  findEtapaById,
  findEtapaPorTexto,
  findFornecedorPorTexto,
  findMaterialPorTexto,
  listObrasAtivas,
  createObra,
  createMaterial,
  createFornecedor,
  createDespesa,
  getObraResumo,
  findOrCreateMaterial,
  findOrCreateFornecedorPorNota,
  upsertEtapasDeObra,
  findFornecedorById,
  findDespesaCompletaById,
  buscarDespesasPorTexto,
  buscarDespesasPorNumeroDocumento,
  updateDespesaCampo,
  deleteDespesaPorId,
  listDespesasRecentes,
  listMateriais,
  listMateriaisSemelhantes,
  findMaterialById,
  deleteObraPorId,
  deleteMaterialPorId,
  deleteFornecedorPorId,
  listFornecedores,
  uploadComprovanteWhatsApp,
  vincularComprovanteDespesa,
} from "./queries";
import { registrarAtividade, getNomePorTelefone } from "@/lib/atividades";
import { notificarComprovantePagamentoAnexado } from "@/lib/alertas/notificar";
import { criarContaAPagar } from "@/lib/contasAPagar/queries";

const MIME_TYPES_PLANILHA = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

type ItemNotaClassificado = InvoiceItem & {
  categoriaId: string;
  categoriaNome: string;
  etapaId: string;
  etapaNome: string;
};

type Dados = {
  valor?: number;
  quantidade?: number | null;
  valorUnitario?: number | null;
  obraId?: string;
  obraNome?: string;
  categoriaId?: string;
  categoriaNome?: string;
  etapaId?: string;
  etapaNome?: string;
  descricao?: string | null;
  nome?: string;

  fornecedorId?: string;
  fornecedorNome?: string;
  notaItens?: InvoiceItem[];
  notaValorTotal?: number | null;
  notaItemIndiceAtual?: number;
  notaItensClassificados?: ItemNotaClassificado[];
  itemCategoriaIdTemp?: string;
  itemCategoriaNomeTemp?: string;

  notaPendente?: InvoiceData;

  orcamentoEtapas?: OrcamentoEtapa[];
  orcamentoValorTotal?: number | null;
  comprovante?: {
    bucket: string;
    path: string;
    mimeType: string;
    tipoDocumento?: "documento_cobranca" | "comprovante_pagamento" | "outro";
    mediaId?: string | null;
    nomeArquivo?: string | null;
    contaOrigemBanco?: string | null;
    contaOrigemTitular?: string | null;
    contaOrigemDocumento?: string | null;
    contaOrigemAgencia?: string | null;
    contaOrigemNumero?: string | null;
    metodoPagamento?: string | null;
    numeroDocumento?: string | null;
  };

  despesaId?: string;
  despesaIdsPagamento?: string[];
  materialId?: string;
  materialNomePendente?: string;

  tipoRemover?: "obra" | "material" | "fornecedor";
  itemRemoverId?: string;
  itemRemoverNome?: string;

  contaAPagarDescricao?: string;
  contaAPagarValor?: number;
  contaAPagarVencimento?: string;
  contaAPagarArquivo?: {
    bucket: string;
    path: string;
    mimeType: string;
    nomeArquivo: string | null;
  } | null;
  contaAPagarObraId?: string | null;
  contaAPagarObraNome?: string | null;
  contaAPagarRecorrencia?: "nenhuma" | "semanal" | "mensal";

  despesaAntes?: {
    id: string;
    obraId: string | null;
    obraNome: string;
    categoriaId: string;
    categoriaNome: string;
    etapaId: string | null;
    etapaNome: string;
    fornecedorId: string | null;
    fornecedorNome: string | null;
    valor: number;
    descricao: string | null;
  };
};

function idSemPrefixo(replyId: string | null, prefixo: string): string | null {
  if (!replyId || !replyId.startsWith(prefixo)) return null;
  return replyId.slice(prefixo.length);
}

/**
 * A lista de toque do WhatsApp so mostra as 10 primeiras etapas (limite da
 * API). Se o usuario tocou num item da lista, usa isso; senao, tenta casar
 * o texto digitado com o nome de uma etapa da obra - assim obras com mais
 * de 10 etapas continuam totalmente acessiveis.
 */
async function resolverEtapaDaMensagem(message: IncomingMessage, obraId: string) {
  const etapaId = idSemPrefixo(message.replyId, "etapa:");
  if (etapaId) return findEtapaById(etapaId);
  if (message.text) return findEtapaPorTexto(obraId, message.text);
  return null;
}

/**
 * Mesma ideia da etapa, mas pra despesa: a lista de toque so mostra os 10
 * lancamentos mais recentes. Se o usuario digitar em vez de tocar, busca
 * por descricao/fornecedor - achou um so, resolve direto; achou varios,
 * manda uma lista so com esses candidatos (e sinaliza que ja respondeu,
 * pra quem chamou nao mandar outra mensagem em cima).
 */
async function resolverDespesaDaMensagem(
  from: string,
  message: IncomingMessage
): Promise<{
  despesa: Awaited<ReturnType<typeof findDespesaCompletaById>>;
  jaRespondeu: boolean;
}> {
  const despesaId = idSemPrefixo(message.replyId, "despesa:");
  if (despesaId) {
    return { despesa: await findDespesaCompletaById(despesaId), jaRespondeu: false };
  }
  if (!message.text) return { despesa: null, jaRespondeu: false };

  const candidatos = await buscarDespesasPorTexto(message.text);
  if (candidatos.length === 1) {
    return { despesa: await findDespesaCompletaById(candidatos[0].id), jaRespondeu: false };
  }
  if (candidatos.length > 1) {
    await sendListDespesasBusca(from, message.text);
    return { despesa: null, jaRespondeu: true };
  }
  return { despesa: null, jaRespondeu: false };
}

const MODELOS_MATERIAL: Record<string, string> = {
  cabo25: "Cabo eletrico 2,5mm",
  cabo40: "Cabo eletrico 4mm",
  cabo60: "Cabo eletrico 6mm",
  canoAgua50: "Cano PVC agua fria 50mm",
  canoEsgoto100: "Cano PVC esgoto 100mm",
  canoEsgoto75: "Cano PVC esgoto 75mm",
};

function modelosPorTexto(texto: string) {
  const normalizado = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizado.includes("cabo")) {
    return ["cabo25", "cabo40", "cabo60"];
  }
  if (normalizado.includes("cano") || normalizado.includes("tubo")) {
    return ["canoAgua50", "canoEsgoto100", "canoEsgoto75"];
  }
  return [];
}

function isMenuReply(replyId: string | null): boolean {
  return Boolean(
    replyId && (Object.values(MENU_IDS) as string[]).includes(replyId)
  );
}

export async function handleIncomingMessage(message: IncomingMessage) {
  const { from } = message;
  const session = await getSession(from);

  if (message.media) {
    if (session.estado_atual === ESTADOS.ANEXAR_PAGAMENTO_ARQUIVO) {
      return handleAnexarPagamentoArquivo(from, message.media, session);
    }
    if (session.estado_atual === ESTADOS.CONTA_A_PAGAR_ARQUIVO) {
      return handleContaAPagarArquivoRecebido(from, message.media);
    }
    if (MIME_TYPES_PLANILHA.includes(message.media.mimeType)) {
      return handleOrcamentoRecebido(from, message.media);
    }
    if (message.media.mimeType.startsWith("audio/")) {
      return handleAudioRecebido(from, message.media);
    }
    return handleNotaFiscalRecebida(from, message.media, {
      forcarNovaDespesa: true,
    });
  }

  const textoNormalizado = message.text?.trim().toLowerCase();

  if (textoNormalizado && COMANDOS_CANCELAR.includes(textoNormalizado)) {
    await resetSession(from);
    await sendText(from, "🏠 Ok, voltando ao menu principal.");
    await sendMenuPrincipal(from);
    return;
  }

  if (isMenuReply(message.replyId)) {
    return handleMenu(from, message);
  }

  if (
    session.estado_atual === ESTADOS.MENU &&
    textoNormalizado &&
    (textoNormalizado.includes("anexar pagamento") ||
      textoNormalizado.includes("comprovante de pagamento") ||
      textoNormalizado === "pagamento")
  ) {
    return iniciarAnexoPagamento(from);
  }

  switch (session.estado_atual) {
    case ESTADOS.MENU:
      return handleMenu(from, message);

    case ESTADOS.DESPESA_VALOR:
      return handleDespesaValor(from, message);
    case ESTADOS.DESPESA_OBRA:
      return handleDespesaObra(from, message, session);
    case ESTADOS.DESPESA_CATEGORIA:
      return handleDespesaCategoria(from, message, session);
    case ESTADOS.DESPESA_ETAPA:
      return handleDespesaEtapa(from, message, session);
    case ESTADOS.DESPESA_MATERIAL:
      return handleDespesaMaterial(from, message, session);
    case ESTADOS.DESPESA_MATERIAL_NOVO:
      return handleDespesaMaterialNovo(from, message, session);
    case ESTADOS.DESPESA_DESCRICAO_PROMPT:
      return handleDespesaDescricaoPrompt(from, message, session);
    case ESTADOS.DESPESA_DESCRICAO_TEXTO:
      return handleDespesaDescricaoTexto(from, message, session);
    case ESTADOS.DESPESA_CONFIRMACAO:
      return handleDespesaConfirmacao(from, message, session);
    case ESTADOS.ANEXAR_PAGAMENTO_ARQUIVO:
      return handleAnexarPagamentoTexto(from, message, session);
    case ESTADOS.ANEXAR_PAGAMENTO_SELECIONANDO_LANCAMENTO:
      return handleAnexarPagamentoSelecionandoLancamento(from, message, session);

    case ESTADOS.CADASTRO_OBRA_NOME:
      return handleCadastroObraNome(from, message);
    case ESTADOS.CADASTRO_OBRA_ORCAMENTO:
      return handleCadastroObraOrcamento(from, message, session);

    case ESTADOS.CADASTRO_MATERIAL_NOME:
      return handleCadastroMaterialNome(from, message);
    case ESTADOS.CADASTRO_MATERIAL_CATEGORIA:
      return handleCadastroMaterialCategoria(from, message, session);

    case ESTADOS.CADASTRO_FORNECEDOR_NOME:
      return handleCadastroFornecedorNome(from, message);
    case ESTADOS.CADASTRO_FORNECEDOR_CONTATO:
      return handleCadastroFornecedorContato(from, message, session);

    case ESTADOS.RESUMO_OBRA:
      return handleResumoObra(from, message);

    case ESTADOS.NOTA_DUPLICADA_CONFIRMACAO:
      return handleNotaDuplicadaConfirmacao(from, message, session);
    case ESTADOS.NOTA_AGUARDANDO_OBRA:
      return handleNotaAguardandoObra(from, message, session);
    case ESTADOS.NOTA_ITEM_CATEGORIA:
      return handleNotaItemCategoria(from, message, session);
    case ESTADOS.NOTA_ITEM_ETAPA:
      return handleNotaItemEtapa(from, message, session);
    case ESTADOS.NOTA_CONFIRMACAO:
      return handleNotaConfirmacao(from, message, session);

    case ESTADOS.ORCAMENTO_AGUARDANDO_OBRA:
      return handleOrcamentoAguardandoObra(from, message, session);
    case ESTADOS.ORCAMENTO_CONFIRMACAO:
      return handleOrcamentoConfirmacao(from, message, session);

    case ESTADOS.CORRIGIR_SELECIONANDO_LANCAMENTO:
      return handleCorrigirSelecionandoLancamento(from, message);
    case ESTADOS.CORRIGIR_SELECIONANDO_CAMPO:
      return handleCorrigirSelecionandoCampo(from, message, session);
    case ESTADOS.CORRIGIR_VALOR_NOVO:
      return handleCorrigirValorNovo(from, message, session);
    case ESTADOS.CORRIGIR_DESCRICAO_NOVA:
      return handleCorrigirDescricaoNova(from, message, session);
    case ESTADOS.CORRIGIR_CATEGORIA_NOVA:
      return handleCorrigirCategoriaNova(from, message, session);
    case ESTADOS.CORRIGIR_ETAPA_NOVA:
      return handleCorrigirEtapaNova(from, message, session);
    case ESTADOS.CORRIGIR_MATERIAL_NOVO:
      return handleCorrigirMaterialNovo(from, message, session);
    case ESTADOS.CORRIGIR_FORNECEDOR_NOVO:
      return handleCorrigirFornecedorNovo(from, message, session);
    case ESTADOS.CORRIGIR_CONFIRMAR_EXCLUSAO:
      return handleCorrigirConfirmarExclusao(from, message, session);

    case ESTADOS.REMOVER_TIPO:
      return handleRemoverTipo(from, message);
    case ESTADOS.REMOVER_SELECIONANDO_ITEM:
      return handleRemoverSelecionandoItem(from, message, session);
    case ESTADOS.REMOVER_CONFIRMACAO:
      return handleRemoverConfirmacao(from, message, session);

    case ESTADOS.RELATORIO_OBRA:
      return handleRelatorioObra(from, message);
    case ESTADOS.RELATORIO_PERIODO:
      return handleRelatorioPeriodo(from, message, session);

    case ESTADOS.CONTA_A_PAGAR_ARQUIVO:
      return handleContaAPagarArquivoTexto(from, message);
    case ESTADOS.CONTA_A_PAGAR_DESCRICAO:
      return handleContaAPagarDescricao(from, message, session);
    case ESTADOS.CONTA_A_PAGAR_VALOR:
      return handleContaAPagarValorManual(from, message, session);
    case ESTADOS.CONTA_A_PAGAR_VENCIMENTO:
      return handleContaAPagarVencimento(from, message, session);
    case ESTADOS.CONTA_A_PAGAR_CONFIRMACAO:
      return handleContaAPagarConfirmacao(from, message, session);
    case ESTADOS.CONTA_A_PAGAR_OBRA:
      return handleContaAPagarObra(from, message, session);
    case ESTADOS.CONTA_A_PAGAR_RECORRENCIA:
      return handleContaAPagarRecorrencia(from, message, session);
    case ESTADOS.CONTA_A_PAGAR_DIAS_AVISO:
      return handleContaAPagarDiasAviso(from, message, session);

    default:
      await resetSession(from);
      await sendMenuPrincipal(from);
  }
}

// ---------- Menu ----------

async function handleMenu(from: string, message: IncomingMessage) {
  switch (message.replyId) {
    case MENU_IDS.REGISTRAR_DESPESA:
      await saveSession(from, ESTADOS.DESPESA_VALOR, {});
      await sendText(from, "💰 Qual o valor da despesa? (ex: 150,00)");
      return;
    case MENU_IDS.CADASTRAR_OBRA:
      await saveSession(from, ESTADOS.CADASTRO_OBRA_NOME, {});
      await sendText(from, "🏗️ Qual o nome da obra?");
      return;
    case MENU_IDS.CADASTRAR_MATERIAL:
      await saveSession(from, ESTADOS.CADASTRO_MATERIAL_NOME, {});
      await sendText(from, "📦 Qual o nome do material? (Ex: Cimento CP-II 50kg)");
      return;
    case MENU_IDS.CADASTRAR_FORNECEDOR:
      await saveSession(from, ESTADOS.CADASTRO_FORNECEDOR_NOME, {});
      await sendText(from, "🏢 Qual o nome do fornecedor?");
      return;
    case MENU_IDS.CONTA_A_PAGAR:
      await iniciarContaAPagar(from);
      return;
    case MENU_IDS.VER_RESUMO:
      await iniciarVerResumo(from);
      return;
    case MENU_IDS.CORRIGIR_LANCAMENTO:
      await iniciarCorrecaoLancamento(from);
      return;
    case MENU_IDS.REMOVER_CADASTRO:
      await iniciarRemoverCadastro(from);
      return;
    case MENU_IDS.RELATORIO:
      await iniciarRelatorio(from);
      return;
    default:
      await sendMenuPrincipal(from);
  }
}

// ---------- Relatório por WhatsApp ----------

async function iniciarRelatorio(from: string) {
  await saveSession(from, ESTADOS.RELATORIO_OBRA, {});
  await sendListObrasParaRelatorio(from);
}

async function handleRelatorioObra(from: string, message: IncomingMessage) {
  const texto = message.text?.trim().toLowerCase();
  if (texto === "0" || texto === "todas") {
    await saveSession(from, ESTADOS.RELATORIO_PERIODO, { obraId: "todas", obraNome: "Todas as obras" });
    await sendListPeriodoRelatorio(from);
    return;
  }

  const obra = message.text ? await findObraPorTexto(message.text) : null;
  if (!obra) {
    await sendListObrasParaRelatorio(from);
    return;
  }

  await saveSession(from, ESTADOS.RELATORIO_PERIODO, { obraId: obra.id, obraNome: obra.nome });
  await sendListPeriodoRelatorio(from);
}

async function handleRelatorioPeriodo(from: string, message: IncomingMessage, session: Session) {
  const dados = session.dados_coletados as Dados;
  if (!message.replyId?.startsWith("periodo:")) {
    await sendListPeriodoRelatorio(from);
    return;
  }

  await sendText(from, "📄 Gerando o relatório, só um instante...");
  await gerarEEnviarRelatorio(from, dados.obraId === "todas" ? null : dados.obraId ?? null, message.replyId);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function iniciarVerResumo(from: string) {
  const obras = await listObrasAtivas();

  if (obras.length === 0) {
    await sendText(
      from,
      "📭 Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra primeiro."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (obras.length === 1) {
    await enviarResumoObra(from, obras[0].id);
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await saveSession(from, ESTADOS.RESUMO_OBRA, {});
  await sendListObras(from);
}

async function enviarResumoObra(from: string, obraId: string) {
  const resumo = await getObraResumo(obraId);
  if (!resumo) {
    await sendText(from, "🏗️ Não encontrei essa obra.");
    return;
  }

  await sendText(
    from,
    `*${resumo.nome}*\n` +
      `💰 Orçamento total: ${formatBRL(resumo.orcamentoTotal)}\n` +
      `📉 Gasto total: ${formatBRL(resumo.gastoTotal)}\n` +
      `💵 Saldo restante: ${formatBRL(resumo.saldoRestante)}\n` +
      `📊 Investido: ${resumo.percentualInvestido.toFixed(1)}%`
  );
}

async function handleResumoObra(from: string, message: IncomingMessage) {
  const obraId = idSemPrefixo(message.replyId, "obra:");
  const obra = obraId
    ? await findObraById(obraId)
    : message.text
      ? await findObraPorTexto(message.text)
      : null;
  if (!obra) {
    await sendListObras(from);
    return;
  }
  await enviarResumoObra(from, obra.id);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

// ---------- Registrar Despesa ----------

async function handleDespesaValor(from: string, message: IncomingMessage) {
  if (!message.text) {
    await sendText(from, "💰 Por favor, digite o valor da despesa (ex: 150,00).");
    return;
  }

  const valor = parseValorBR(message.text);
  if (valor === null) {
    await sendText(
      from,
      "💰 Não entendi o valor. Digite apenas o número, ex: 150,00"
    );
    return;
  }

  const obras = await listObrasAtivas();
  if (obras.length === 0) {
    await sendText(
      from,
      "📭 Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra antes de registrar despesas."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await saveSession(from, ESTADOS.DESPESA_OBRA, { valor });
  await sendListObras(from);
}

async function handleDespesaObra(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const obraId = idSemPrefixo(message.replyId, "obra:");
  const obra = obraId
    ? await findObraById(obraId)
    : message.text
      ? await findObraPorTexto(message.text)
      : null;
  if (!obra) {
    await sendListObras(from);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    obraId: obra.id,
    obraNome: obra.nome,
  };
  await saveSession(from, ESTADOS.DESPESA_CATEGORIA, dados);
  await sendListCategorias(from);
}

async function handleDespesaCategoria(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const categoriaId = idSemPrefixo(message.replyId, "categoria:");
  const categoria = categoriaId
    ? await findCategoriaById(categoriaId)
    : message.text
      ? await findCategoriaPorTexto(message.text)
      : null;
  if (!categoria) {
    await sendListCategorias(from);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    categoriaId: categoria.id,
    categoriaNome: categoria.nome,
  };

  // Categorias que nao representam uma etapa fisica do cronograma (ex:
  // Despesas Administrativas) pulam direto pro passo seguinte, sem
  // perguntar etapa.
  if (categoria.usa_etapa === false) {
    await continuarAposEtapa(from, dados);
    return;
  }

  await saveSession(from, ESTADOS.DESPESA_ETAPA, dados);
  await sendListEtapas(from, dados.obraId!);
}

async function handleDespesaEtapa(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const etapa = await resolverEtapaDaMensagem(message, (session.dados_coletados as Dados).obraId!);
  if (!etapa) {
    await sendListEtapas(from, (session.dados_coletados as Dados).obraId!);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    etapaId: etapa.id,
    etapaNome: etapa.nome,
  };
  await continuarAposEtapa(from, dados);
}

async function continuarAposEtapa(from: string, dados: Dados) {
  // Categoria "Material" sempre exige selecionar/cadastrar um material,
  // mesmo quando a descricao ja veio preenchida por IA (audio/comprovante) -
  // senao o lancamento fica sem material_id (aparece "-" no dashboard).
  if (dados.categoriaNome?.toLowerCase() === "material" && !dados.materialId) {
    await saveSession(from, ESTADOS.DESPESA_MATERIAL, dados);
    await sendListMateriaisParaDespesa(from);
    return;
  }

  // Se a descricao ja veio preenchida (extraida por IA de audio/comprovante),
  // deixa o usuario manter ou editar em vez de travar no texto automatico.
  if (dados.descricao) {
    await perguntarSeMantemOuEditaDescricao(from, dados, dados.descricao);
    return;
  }

  await saveSession(from, ESTADOS.DESPESA_DESCRICAO_PROMPT, dados);
  await sendButtons(from, "💸 Deseja adicionar uma descrição para esta despesa?", [
    { id: "desc:add", title: "Adicionar" },
    { id: "desc:skip", title: "Pular" },
  ]);
}

async function perguntarSeMantemOuEditaDescricao(
  from: string,
  dados: Dados,
  descricaoAtual: string
) {
  await saveSession(from, ESTADOS.DESPESA_DESCRICAO_PROMPT, dados);
  await sendButtons(
    from,
    `💸 Descrição atual: "${descricaoAtual}". Quer manter ou editar?`,
    [
      { id: "desc:manter", title: "Manter" },
      { id: "desc:add", title: "Editar" },
    ]
  );
}

async function finalizarSelecaoMaterial(
  from: string,
  dados: Dados,
  material: { id: string; nome: string }
) {
  const descricaoOriginal = dados.descricao;
  const novosDados: Dados = {
    ...dados,
    materialId: material.id,
    descricao: descricaoOriginal ?? material.nome,
    materialNomePendente: undefined,
  };

  if (descricaoOriginal) {
    await perguntarSeMantemOuEditaDescricao(from, novosDados, descricaoOriginal);
    return;
  }

  await saveSession(from, ESTADOS.DESPESA_CONFIRMACAO, novosDados);
  await enviarConfirmacao(from, novosDados);
}

async function handleDespesaMaterial(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const dados = session.dados_coletados as Dados;

  if (message.replyId === "material:novo_confirm" && dados.materialNomePendente) {
    const material = await findOrCreateMaterial(
      dados.materialNomePendente,
      dados.categoriaId!
    );
    await finalizarSelecaoMaterial(from, dados, material);
    return;
  }

  const modeloId = idSemPrefixo(message.replyId, "material:modelo:");
  if (modeloId && MODELOS_MATERIAL[modeloId]) {
    const material = await findOrCreateMaterial(
      MODELOS_MATERIAL[modeloId],
      dados.categoriaId!
    );
    await finalizarSelecaoMaterial(from, dados, material);
    return;
  }

  if (message.replyId === "material:novo" || message.text?.trim().toLowerCase() === "novo") {
    await saveSession(from, ESTADOS.DESPESA_MATERIAL_NOVO, dados);
    await sendText(
      from,
      "📦 Qual o material? Seja específico (ex: Cano PVC água fria 50mm, Cano PVC esgoto 100mm, Cabo elétrico 2,5mm, Cimento CP-II 50kg):"
    );
    return;
  }

  const materialId = idSemPrefixo(message.replyId, "material:");
  const material = materialId
    ? await findMaterialById(materialId)
    : message.text
      ? await findMaterialPorTexto(message.text)
      : null;
  if (!material) {
    await sendListMateriaisParaDespesa(from);
    return;
  }

  await finalizarSelecaoMaterial(from, dados, material);
}

async function handleDespesaMaterialNovo(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (!message.text) {
    await sendText(from, "📦 Digite o nome do material.");
    return;
  }

  const dados = session.dados_coletados as Dados;
  const nome = message.text.trim();
  const sugestoes = await listMateriaisSemelhantes(nome, 2);

  if (sugestoes.length > 0) {
    await saveSession(from, ESTADOS.DESPESA_MATERIAL, {
      ...dados,
      materialNomePendente: nome,
    });
    await sendButtons(
      from,
      `📦 Encontrei material parecido com "${nome}". Quer usar um existente ou cadastrar esse novo?`,
      [
        ...sugestoes.map((m) => ({ id: `material:${m.id}`, title: m.nome.slice(0, 20) })),
        { id: "material:novo_confirm", title: "Cadastrar novo" },
      ]
    );
    return;
  }

  const modelos = modelosPorTexto(nome);
  if (modelos.length > 0) {
    await saveSession(from, ESTADOS.DESPESA_MATERIAL, {
      ...dados,
      materialNomePendente: nome,
    });
    await sendButtons(
      from,
      `👉 Escolha um tipo comum para "${nome}" ou cadastre exatamente como voce digitou.`,
      [
        ...modelos.slice(0, 2).map((id) => ({
          id: `material:modelo:${id}`,
          title: MODELOS_MATERIAL[id].slice(0, 20),
        })),
        { id: "material:novo_confirm", title: "Cadastrar texto" },
      ]
    );
    return;
  }

  const material = await findOrCreateMaterial(nome, dados.categoriaId!);
  await finalizarSelecaoMaterial(from, dados, material);
}

async function handleDespesaDescricaoPrompt(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (message.replyId === "desc:add") {
    await saveSession(from, ESTADOS.DESPESA_DESCRICAO_TEXTO, session.dados_coletados);
    await sendText(
      from,
      "💳 Digite a descrição da despesa:\n(Ex: Compra de cimento, Pagamento pedreiro, etc.)"
    );
    return;
  }

  if (message.replyId === "desc:manter") {
    const dados = session.dados_coletados as Dados;
    await saveSession(from, ESTADOS.DESPESA_CONFIRMACAO, dados);
    await enviarConfirmacao(from, dados);
    return;
  }

  if (message.replyId === "desc:skip") {
    const dados: Dados = { ...session.dados_coletados, descricao: null };
    await saveSession(from, ESTADOS.DESPESA_CONFIRMACAO, dados);
    await enviarConfirmacao(from, dados);
    return;
  }

  await sendButtons(from, "💸 Deseja adicionar uma descrição para esta despesa?", [
    { id: "desc:add", title: "Adicionar" },
    { id: "desc:skip", title: "Pular" },
  ]);
}

async function handleDespesaDescricaoTexto(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (!message.text) {
    await sendText(from, "💸 Digite a descrição da despesa.");
    return;
  }

  const dados: Dados = { ...session.dados_coletados, descricao: message.text };
  await saveSession(from, ESTADOS.DESPESA_CONFIRMACAO, dados);
  await enviarConfirmacao(from, dados);
}

async function enviarConfirmacao(from: string, dados: Dados) {
  let texto =
    `*Confirme os dados:*\n` +
    `💰 Valor: ${formatBRL(dados.valor!)}
` +
    `🏗️ Obra: ${dados.obraNome}
` +
    `📁 Categoria: ${dados.categoriaNome}`;

  if (dados.etapaNome) {
    texto += `
📐 Etapa: ${dados.etapaNome}`;
  }

  if (dados.fornecedorNome) {
    texto += `
🏢 Fornecedor: ${dados.fornecedorNome}`;
  }
  if (dados.descricao) {
    texto += `
📝 Descrição: ${dados.descricao}`;
  }

  await sendButtons(from, texto, [
    { id: "confirm:sim", title: "Confirmar" },
    { id: "confirm:nao", title: "Cancelar" },
  ]);
}

async function handleDespesaConfirmacao(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (message.replyId === "confirm:sim") {
    const dados = session.dados_coletados as Dados;
    const autorNome = await getNomePorTelefone(from);
    const despesa = await createDespesa({
      obraId: dados.obraId!,
      categoriaId: dados.categoriaId!,
      etapaId: dados.etapaId ?? null,
      valor: dados.valor!,
      descricao: dados.descricao ?? null,
      quantidade: dados.quantidade ?? null,
      valorUnitario: dados.valorUnitario ?? null,
      fornecedorId: dados.fornecedorId ?? null,
      materialId: dados.materialId ?? null,
      criadoPorTelefone: from,
      criadoPorNome: autorNome,
      documentoAnexado:
        dados.comprovante?.tipoDocumento === "documento_cobranca" ||
        dados.comprovante?.tipoDocumento === "comprovante_pagamento"
          ? dados.comprovante.tipoDocumento
          : null,
    });
    if (dados.comprovante) {
      await vincularComprovanteDespesa({
        despesaId: despesa.id,
        comprovante: dados.comprovante,
      });
    }
    await registrarAtividade({
      tipo: "criacao",
      entidade: "despesa",
      entidadeId: despesa.id,
      origem: "whatsapp",
      autorTelefone: from,
      autorNome,
      resumo: `Despesa de ${formatBRL(dados.valor!)} (${dados.categoriaNome}, ${dados.obraNome}) registrada por ${autorNome}`,
      dadosDepois: dados,
    });
    await sendText(from, "✅ Despesa registrada com sucesso!");

    if (dados.comprovante?.tipoDocumento === "comprovante_pagamento") {
      await sendText(
        from,
        "💳 Pagamento marcado como comprovado porque o arquivo enviado já era um comprovante de pagamento."
      );
      await resetSession(from);
      await sendMenuPrincipal(from);
      return;
    }

    await saveSession(from, ESTADOS.ANEXAR_PAGAMENTO_ARQUIVO, {
      despesaIdsPagamento: [despesa.id],
    });
    await sendText(
      from,
      "💳 Se você já tiver o comprovante de pagamento dessa conta/nota, envie a imagem ou PDF agora. Se ainda não tiver, digite *pular* ou *menu*."
    );
    return;
  }

  if (message.replyId === "confirm:nao") {
    await sendText(from, "🚫 Despesa cancelada.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await enviarConfirmacao(from, session.dados_coletados);
}

// ---------- Cadastrar Obra ----------

async function handleCadastroObraNome(from: string, message: IncomingMessage) {
  if (!message.text) {
    await sendText(from, "🏗️ Qual o nome da obra?");
    return;
  }
  await saveSession(from, ESTADOS.CADASTRO_OBRA_ORCAMENTO, { nome: message.text });
  await sendText(from, "🏗️ Qual o orçamento total dessa obra? (ex: 500000,00)");
}

async function handleCadastroObraOrcamento(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (!message.text) {
    await sendText(from, "🏗️ Qual o orçamento total dessa obra? (ex: 500000,00)");
    return;
  }
  const valor = parseValorBR(message.text);
  if (valor === null) {
    await sendText(from, "💰 Não entendi o valor. Digite apenas o número, ex: 500000,00");
    return;
  }

  const nome = session.dados_coletados.nome as string;
  const obra = await createObra(nome, valor);
  const autorNome = await getNomePorTelefone(from);
  await registrarAtividade({
    tipo: "criacao",
    entidade: "obra",
    entidadeId: obra.id,
    origem: "whatsapp",
    autorTelefone: from,
    autorNome,
    resumo: `Obra "${nome}" cadastrada (orçamento ${formatBRL(valor)}) por ${autorNome}`,
    dadosDepois: { nome, orcamentoTotal: valor },
  });
  await sendText(
    from,
    `✅ Obra "${nome}" cadastrada com orçamento de ${formatBRL(valor)}.`
  );
  await resetSession(from);
  await sendMenuPrincipal(from);
}

// ---------- Cadastrar Material ----------

async function handleCadastroMaterialNome(from: string, message: IncomingMessage) {
  if (!message.text) {
    await sendText(from, "📦 Qual o nome do material?");
    return;
  }
  await saveSession(from, ESTADOS.CADASTRO_MATERIAL_CATEGORIA, {
    nome: message.text,
  });
  await sendListCategorias(from);
}

async function handleCadastroMaterialCategoria(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const categoriaId = idSemPrefixo(message.replyId, "categoria:");
  const categoria = categoriaId
    ? await findCategoriaById(categoriaId)
    : message.text
      ? await findCategoriaPorTexto(message.text)
      : null;
  if (!categoria) {
    await sendListCategorias(from);
    return;
  }

  const nome = session.dados_coletados.nome as string;
  const material = await createMaterial(nome, categoria.id);
  const autorNome = await getNomePorTelefone(from);
  await registrarAtividade({
    tipo: "criacao",
    entidade: "material",
    entidadeId: material.id,
    origem: "whatsapp",
    autorTelefone: from,
    autorNome,
    resumo: `Material "${nome}" cadastrado na categoria ${categoria.nome} por ${autorNome}`,
    dadosDepois: { nome, categoria: categoria.nome },
  });
  await sendText(
    from,
    `✅ Material "${nome}" cadastrado na categoria ${categoria.nome}.`
  );
  await resetSession(from);
  await sendMenuPrincipal(from);
}

// ---------- Cadastrar Fornecedor ----------

async function handleCadastroFornecedorNome(from: string, message: IncomingMessage) {
  if (!message.text) {
    await sendText(from, "🏢 Qual o nome do fornecedor?");
    return;
  }
  await saveSession(from, ESTADOS.CADASTRO_FORNECEDOR_CONTATO, {
    nome: message.text,
  });
  await sendText(
    from,
    "🏢 Qual o contato do fornecedor (telefone)? Digite 'pular' se não quiser informar."
  );
}

async function handleCadastroFornecedorContato(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (!message.text) {
    await sendText(from, "☎️ Digite o contato do fornecedor ou 'pular'.");
    return;
  }

  const contato = message.text.trim().toLowerCase() === "pular" ? null : message.text;
  const nome = session.dados_coletados.nome as string;
  const fornecedor = await createFornecedor(nome, contato);
  const autorNome = await getNomePorTelefone(from);
  await registrarAtividade({
    tipo: "criacao",
    entidade: "fornecedor",
    entidadeId: fornecedor.id,
    origem: "whatsapp",
    autorTelefone: from,
    autorNome,
    resumo: `Fornecedor "${nome}" cadastrado por ${autorNome}`,
    dadosDepois: { nome, contato },
  });
  await sendText(from, `✅ Fornecedor "${nome}" cadastrado.`);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

// ---------- Nota Fiscal / Comprovante / Áudio ----------

async function handleNotaFiscalRecebida(
  from: string,
  media: IncomingMedia,
  options: { forcarNovaDespesa?: boolean } = {}
) {
  await sendText(from, "📄 Recebi seu documento, analisando...");

  let invoice;
  let comprovante: Dados["comprovante"] | undefined;
  try {
    const { buffer, mimeType } = await downloadWhatsAppMedia(media.id);
    invoice = await extractInvoiceData(buffer, mimeType);
    const tipoDocumento =
      invoice?.tipoDocumento === "comprovante_pagamento"
        ? "comprovante_pagamento"
        : "documento_cobranca";

    comprovante = await uploadComprovanteWhatsApp({
      telefone: from,
      mediaId: media.id,
      buffer,
      mimeType,
      tipoDocumento,
      contaOrigemBanco: invoice?.contaOrigemBanco ?? null,
      contaOrigemTitular: invoice?.contaOrigemTitular ?? null,
      contaOrigemDocumento: invoice?.contaOrigemDocumento ?? null,
      contaOrigemAgencia: invoice?.contaOrigemAgencia ?? null,
      contaOrigemNumero: invoice?.contaOrigemNumero ?? null,
      metodoPagamento: invoice?.metodoPagamento ?? null,
      numeroDocumento: invoice?.numeroDocumento ?? null,
    });
  } catch (error) {
    console.error("Erro ao processar comprovante:", error);
    Sentry.captureException(error, { tags: { fluxo: "nota_fiscal_recebida" } });
    invoice = null;
  }

  // O Gemini as vezes classifica certo como comprovante de pagamento mas
  // nao segue a instrucao de devolver um item unico (ex: recibo de Pix sem
  // "itens" discriminados) - sem isso a checagem abaixo jogava fora um
  // valorTotalNota perfeitamente valido e forcava preenchimento manual
  // completo. Sintetiza um item a partir do valor total antes de desistir.
  if (invoice && invoice.itens.length === 0 && invoice.valorTotalNota) {
    invoice = {
      ...invoice,
      itens: [
        {
          descricao:
            invoice.fornecedorNome && invoice.fornecedorNome !== "Não identificado"
              ? `Pagamento a ${invoice.fornecedorNome}`
              : "Pagamento",
          quantidade: 1,
          valorUnitario: invoice.valorTotalNota,
          valorTotal: invoice.valorTotalNota,
        },
      ],
    };
  }

  if (!options.forcarNovaDespesa && invoice?.tipoDocumento === "comprovante_pagamento" && comprovante) {
    await saveSession(from, ESTADOS.ANEXAR_PAGAMENTO_SELECIONANDO_LANCAMENTO, {
      comprovante,
    });
    await sendText(
      from,
      "💳 Identifiquei este arquivo como comprovante de pagamento. Escolha qual lançamento ele deve quitar. Se sua intenção era criar uma nova despesa com esse comprovante, toque em Registrar Despesa e envie o arquivo novamente."
    );
    await sendListDespesasRecentes(from);
    return;
  }

  if (!invoice || invoice.itens.length === 0) {
    await iniciarFallbackManual(
      from,
      "Não consegui ler os dados automaticamente. Vamos registrar manualmente: qual o valor da despesa? (ex: 150,00)",
      comprovante ? { comprovante } : {}
    );
    return;
  }

  if (!options.forcarNovaDespesa && invoice.numeroDocumento) {
    const duplicadas = await buscarDespesasPorNumeroDocumento(invoice.numeroDocumento);
    if (duplicadas.length > 0) {
      const dadosPendentes: Dados = { notaPendente: invoice, comprovante };
      await saveSession(from, ESTADOS.NOTA_DUPLICADA_CONFIRMACAO, dadosPendentes);
      const linhasExistentes = duplicadas
        .slice(0, 3)
        .map((d) => `• ${formatBRL(d.valor)} — ${d.obraNome} (${formatDataBR(d.data)})`)
        .join("\n");
      await sendButtons(
        from,
        `⚠️ *Nota já lançada antes?*\n\nO documento nº ${invoice.numeroDocumento} já tem despesa(s) registrada(s):\n${linhasExistentes}\n\nQuer lançar mesmo assim ou cancelar?`,
        [
          { id: "nota_duplicada:continuar", title: "Lançar mesmo assim" },
          { id: "nota_duplicada:cancelar", title: "Cancelar" },
        ]
      );
      return;
    }
  }

  await continuarProcessamentoNota(from, invoice, comprovante);
}

function formatDataBR(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function handleNotaDuplicadaConfirmacao(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const dados = session.dados_coletados as Dados;

  if (message.replyId === "nota_duplicada:cancelar") {
    await sendText(from, "🚫 Ok, não lancei essa nota de novo.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId !== "nota_duplicada:continuar" || !dados.notaPendente) {
    await sendButtons(from, "⚠️ Lançar essa nota mesmo já tendo uma parecida registrada?", [
      { id: "nota_duplicada:continuar", title: "Lançar mesmo assim" },
      { id: "nota_duplicada:cancelar", title: "Cancelar" },
    ]);
    return;
  }

  await continuarProcessamentoNota(from, dados.notaPendente, dados.comprovante);
}

async function continuarProcessamentoNota(
  from: string,
  invoice: InvoiceData,
  comprovante: Dados["comprovante"] | undefined
) {
  const obras = await listObrasAtivas();
  if (obras.length === 0) {
    await sendText(
      from,
      "📭 Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra antes de registrar despesas."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  const fornecedor = await findOrCreateFornecedorPorNota({
    nome: invoice.fornecedorNome,
    cnpj: invoice.fornecedorCnpj,
    cpf: invoice.fornecedorCpf,
    chavePix: invoice.fornecedorChavePix,
    contaBanco: invoice.fornecedorContaBanco,
    contaAgencia: invoice.fornecedorContaAgencia,
    contaNumero: invoice.fornecedorContaNumero,
  });

  // Documento com um único item: reaproveita o fluxo guiado de despesa
  // (obra -> categoria -> etapa -> confirma). Se o arquivo for comprovante
  // de pagamento e o usuário estava em Registrar Despesa, ele vira uma nova
  // despesa já paga, com o arquivo no ícone de pagamento.
  if (invoice.itens.length === 1) {
    await iniciarDespesaUnicaExtraida(from, {
      valor: invoice.itens[0].valorTotal,
      descricao: invoice.itens[0].descricao,
      quantidade: invoice.itens[0].quantidade,
      valorUnitario: invoice.itens[0].valorUnitario,
      fornecedorId: fornecedor.id,
      fornecedorNome: fornecedor.nome,
      comprovante,
    });
    return;
  }

  const dados: Dados = {
    fornecedorId: fornecedor.id,
    fornecedorNome: fornecedor.nome,
    notaItens: invoice.itens,
    notaValorTotal: invoice.valorTotalNota,
    comprovante,
  };

  await saveSession(from, ESTADOS.NOTA_AGUARDANDO_OBRA, dados);
  await sendText(
    from,
    `🏗️ Encontrei ${invoice.itens.length} itens do fornecedor *${fornecedor.nome}*. Em qual obra isso deve ser lançado?`
  );
  await sendListObras(from);
}

async function handleAudioRecebido(from: string, media: IncomingMedia) {
  await sendText(from, "🎙️ Recebi seu áudio, entendendo...");

  let extraido;
  try {
    const { buffer, mimeType } = await downloadWhatsAppMedia(media.id);
    extraido = await extractDespesaDeAudio(buffer, mimeType);
   } catch (error) {
    console.error("Erro ao processar áudio:", error);
    extraido = null;
  }

  if (!extraido || !extraido.valor || !extraido.descricao) {
    await iniciarFallbackManual(
      from,
      "Não consegui entender o valor e o que foi essa despesa no áudio. Pode digitar o valor? (ex: 150,00)"
    );
    return;
  }

  let fornecedorId: string | undefined;
  let fornecedorNome: string | undefined;
  if (extraido.fornecedorNome) {
    const fornecedor = await findOrCreateFornecedorPorNota({
      nome: extraido.fornecedorNome,
    });
    fornecedorId = fornecedor.id;
    fornecedorNome = fornecedor.nome;
  }

  await iniciarDespesaUnicaExtraida(from, {
    valor: extraido.valor,
    descricao: extraido.descricao,
    fornecedorId,
    fornecedorNome,
  });
}

/**
 * Ponto de entrada compartilhado para qualquer despesa unica extraida por
 * IA (recibo simples, comprovante de pagamento ou audio). Segue o mesmo
 * fluxo guiado da despesa manual (obra -> categoria -> etapa -> confirmar),
 * pre-preenchendo apenas o que a IA conseguiu extrair.
 */
async function iniciarDespesaUnicaExtraida(
  from: string,
  extraido: {
    valor: number;
    descricao: string;
    quantidade?: number | null;
    valorUnitario?: number | null;
    fornecedorId?: string;
    fornecedorNome?: string;
    comprovante?: Dados["comprovante"];
  }
) {
  const obras = await listObrasAtivas();
  if (obras.length === 0) {
    await sendText(
      from,
      "📭 Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra antes de registrar despesas."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  const dados: Dados = {
    valor: extraido.valor,
    descricao: extraido.descricao,
    quantidade: extraido.quantidade ?? null,
    valorUnitario: extraido.valorUnitario ?? null,
    fornecedorId: extraido.fornecedorId,
    fornecedorNome: extraido.fornecedorNome,
    comprovante: extraido.comprovante,
  };

  await saveSession(from, ESTADOS.DESPESA_OBRA, dados);
  await sendText(
    from,
    `✅ *Identifiquei uma nova despesa*\n` +
      `💰 *Valor:* ${formatBRL(extraido.valor)}\n` +
      `📝 *Descrição:* ${extraido.descricao}\n\n` +
      `🏗️ Em qual obra isso deve ser lançado?`
  );
  await sendListObras(from);
}

async function iniciarFallbackManual(
  from: string,
  mensagem: string,
  dados: Pick<Dados, "comprovante"> = {}
) {
  await saveSession(from, ESTADOS.DESPESA_VALOR, dados);
  await sendText(from, mensagem);
}

async function handleAnexarPagamentoTexto(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const texto = message.text?.trim().toLowerCase();
  if (texto === "pular" || texto === "depois" || texto === "não" || texto === "nao") {
    await sendText(
      from,
      "💳 Ok. O lançamento ficou com pagamento pendente no dashboard. Quando quiser registrar o pagamento, envie o comprovante pelo fluxo de anexo."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await saveSession(from, ESTADOS.ANEXAR_PAGAMENTO_ARQUIVO, session.dados_coletados);
  await sendText(
    from,
    "💳 Envie a imagem ou PDF do comprovante de pagamento agora. Se ainda não tiver, digite *pular*."
  );
}

async function iniciarAnexoPagamento(from: string) {
  await saveSession(from, ESTADOS.ANEXAR_PAGAMENTO_SELECIONANDO_LANCAMENTO, {});
  await sendText(from, "💳 Escolha o lançamento que deve receber o comprovante de pagamento.");
  await sendListDespesasRecentes(from);
}

async function handleAnexarPagamentoSelecionandoLancamento(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const { despesa, jaRespondeu } = await resolverDespesaDaMensagem(from, message);
  if (jaRespondeu) return;

  if (!despesa) {
    await sendText(from, "👉 Não encontrei esse lançamento. Escolha novamente.");
    await sendListDespesasRecentes(from);
    return;
  }

  const dados = session.dados_coletados as Dados;
  if (dados.comprovante) {
    const autorNome = await getNomePorTelefone(from);
    await vincularComprovanteDespesa({
      despesaId: despesa.id,
      comprovante: {
        ...dados.comprovante,
        tipoDocumento: "comprovante_pagamento",
      },
    });
    await registrarAtividade({
      tipo: "edicao",
      entidade: "despesa",
      entidadeId: despesa.id,
      origem: "whatsapp",
      autorTelefone: from,
      autorNome,
      resumo: `Comprovante de pagamento anexado ao lançamento de ${formatBRL(despesa.valor)} por ${autorNome}`,
      dadosDepois: { despesaId: despesa.id, comprovantePagamento: dados.comprovante },
    });
    notificarComprovantePagamentoAnexado({
      valor: despesa.valor,
      obraId: despesa.obraId,
      autorTelefone: from,
      autorNome,
    }).catch((error) => {
      console.error("Falha ao notificar comprovante de pagamento por WhatsApp:", error);
      Sentry.captureException(error);
    });
    await sendText(from, "✅ Comprovante de pagamento vinculado com sucesso.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await saveSession(from, ESTADOS.ANEXAR_PAGAMENTO_ARQUIVO, {
    despesaIdsPagamento: [despesa.id],
  });
  await sendText(
    from,
    `💳 Agora envie a imagem ou PDF do comprovante de pagamento de ${formatBRL(despesa.valor)}.`
  );
}

async function handleAnexarPagamentoArquivo(
  from: string,
  media: IncomingMedia,
  session: Session
) {
  const dados = session.dados_coletados as Dados;
  const despesaIds = dados.despesaIdsPagamento ?? [];

  if (despesaIds.length === 0) {
    await sendText(from, "💳 Não encontrei o lançamento para vincular esse pagamento.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  try {
    const { buffer, mimeType } = await downloadWhatsAppMedia(media.id);
    const pagamentoExtraido = await extractInvoiceData(buffer, mimeType);
    const comprovantePagamento = await uploadComprovanteWhatsApp({
      telefone: from,
      mediaId: media.id,
      buffer,
      mimeType,
      tipoDocumento: "comprovante_pagamento",
      contaOrigemBanco: pagamentoExtraido?.contaOrigemBanco ?? null,
      contaOrigemTitular: pagamentoExtraido?.contaOrigemTitular ?? null,
      contaOrigemDocumento: pagamentoExtraido?.contaOrigemDocumento ?? null,
      contaOrigemAgencia: pagamentoExtraido?.contaOrigemAgencia ?? null,
      contaOrigemNumero: pagamentoExtraido?.contaOrigemNumero ?? null,
      metodoPagamento: pagamentoExtraido?.metodoPagamento ?? null,
    });

    for (const despesaId of despesaIds) {
      await vincularComprovanteDespesa({
        despesaId,
        comprovante: comprovantePagamento,
      });
    }

    const autorNome = await getNomePorTelefone(from);
    await registrarAtividade({
      tipo: "edicao",
      entidade: "despesa",
      entidadeId: despesaIds[0],
      origem: "whatsapp",
      autorTelefone: from,
      autorNome,
      resumo:
        despesaIds.length > 1
          ? `Comprovante de pagamento anexado a ${despesaIds.length} lançamentos por ${autorNome}`
          : `Comprovante de pagamento anexado por ${autorNome}`,
      dadosDepois: { despesaIds, comprovantePagamento, pagamentoExtraido },
    });

    const despesasVinculadas = await Promise.all(despesaIds.map((id) => findDespesaCompletaById(id)));
    const valorTotalVinculado = despesasVinculadas.reduce((soma, d) => soma + (d?.valor ?? 0), 0);
    notificarComprovantePagamentoAnexado({
      valor: valorTotalVinculado,
      obraId: despesasVinculadas[0]?.obraId ?? null,
      autorTelefone: from,
      autorNome,
    }).catch((error) => {
      console.error("Falha ao notificar comprovante de pagamento por WhatsApp:", error);
      Sentry.captureException(error);
    });

    const valorLido = pagamentoExtraido?.valorTotalNota ?? pagamentoExtraido?.itens?.[0]?.valorTotal;
    const fornecedorLido =
      pagamentoExtraido?.fornecedorNome &&
      pagamentoExtraido.fornecedorNome !== "Não identificado"
        ? pagamentoExtraido.fornecedorNome
        : null;
    const tipoLido =
      pagamentoExtraido?.tipoDocumento === "comprovante_pagamento"
        ? "comprovante de pagamento"
        : pagamentoExtraido?.tipoDocumento
          ? "documento financeiro"
          : null;
    const contaOrigemLida = [
      pagamentoExtraido?.contaOrigemBanco,
      pagamentoExtraido?.contaOrigemTitular,
      pagamentoExtraido?.contaOrigemAgencia
        ? `Ag. ${pagamentoExtraido.contaOrigemAgencia}`
        : null,
      pagamentoExtraido?.contaOrigemNumero
        ? `Conta ${pagamentoExtraido.contaOrigemNumero}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");


    const resumoLeitura = [
      "✅ Comprovante de pagamento anexado com sucesso.",
      valorLido ? `💰 Valor identificado: ${formatBRL(valorLido)}` : null,
      fornecedorLido ? `🏢 Recebedor: ${fornecedorLido}` : null,
      contaOrigemLida ? `Banco/conta de origem: ${contaOrigemLida}` : null,
      pagamentoExtraido?.metodoPagamento
        ? `Metodo: ${pagamentoExtraido.metodoPagamento}`
        : null,
      tipoLido ? `📌 Tipo: ${tipoLido}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await sendText(from, resumoLeitura);
  } catch (error) {
    console.error("Erro ao anexar comprovante de pagamento:", error);
    await sendText(
      from,
      "💳 Não consegui salvar esse comprovante de pagamento. Tente enviar novamente em imagem ou PDF."
    );
    return;
  }

  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleNotaAguardandoObra(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const obraId = idSemPrefixo(message.replyId, "obra:");
  const obra = obraId
    ? await findObraById(obraId)
    : message.text
      ? await findObraPorTexto(message.text)
      : null;
  if (!obra) {
    await sendListObras(from);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    obraId: obra.id,
    obraNome: obra.nome,
    notaItemIndiceAtual: 0,
    notaItensClassificados: [],
  };
  await perguntarClassificacaoItemAtual(from, dados);
}

/**
 * Nota fiscal com varios itens: cada item pode ser de uma etapa (e ate
 * categoria) diferente, entao classificamos um item por vez em vez de
 * aplicar uma unica categoria/etapa pra nota inteira.
 */
async function perguntarClassificacaoItemAtual(from: string, dados: Dados) {
  const itens = dados.notaItens ?? [];
  const indice = dados.notaItemIndiceAtual ?? 0;
  const item = itens[indice];

  await saveSession(from, ESTADOS.NOTA_ITEM_CATEGORIA, dados);
  await sendText(
    from,
    `💰 Item ${indice + 1}/${itens.length}: *${item.descricao}* — ${formatBRL(item.valorTotal)}\nQual a categoria desse item?`
  );
  await sendListCategorias(from);
}

async function handleNotaItemCategoria(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const categoriaId = idSemPrefixo(message.replyId, "categoria:");
  const categoria = categoriaId
    ? await findCategoriaById(categoriaId)
    : message.text
      ? await findCategoriaPorTexto(message.text)
      : null;
  if (!categoria) {
    await sendListCategorias(from);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    itemCategoriaIdTemp: categoria.id,
    itemCategoriaNomeTemp: categoria.nome,
  };
  await saveSession(from, ESTADOS.NOTA_ITEM_ETAPA, dados);
  await sendListEtapas(from, dados.obraId!);
}

async function handleNotaItemEtapa(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const etapa = await resolverEtapaDaMensagem(message, (session.dados_coletados as Dados).obraId!);
  if (!etapa) {
    await sendListEtapas(from, (session.dados_coletados as Dados).obraId!);
    return;
  }

  const dados = session.dados_coletados as Dados;
  const indice = dados.notaItemIndiceAtual ?? 0;
  const item = (dados.notaItens ?? [])[indice];

  const itemClassificado: ItemNotaClassificado = {
    ...item,
    categoriaId: dados.itemCategoriaIdTemp!,
    categoriaNome: dados.itemCategoriaNomeTemp!,
    etapaId: etapa.id,
    etapaNome: etapa.nome,
  };

  const novosDados: Dados = {
    ...dados,
    notaItensClassificados: [...(dados.notaItensClassificados ?? []), itemClassificado],
    notaItemIndiceAtual: indice + 1,
    itemCategoriaIdTemp: undefined,
    itemCategoriaNomeTemp: undefined,
  };

  if (novosDados.notaItemIndiceAtual! < (dados.notaItens ?? []).length) {
    await perguntarClassificacaoItemAtual(from, novosDados);
    return;
  }

  await saveSession(from, ESTADOS.NOTA_CONFIRMACAO, novosDados);
  await enviarConfirmacaoNota(from, novosDados);
}

async function enviarConfirmacaoNota(from: string, dados: Dados) {
  const itens = dados.notaItensClassificados ?? [];
  const linhasItens = itens
    .map((item, i) => {
      const qtdELinha =
        item.quantidade !== 1
          ? `${item.quantidade}x${item.valorUnitario ? ` de ${formatBRL(item.valorUnitario)}` : ""} = `
          : "";
      return `${i + 1}. ${item.descricao} — ${qtdELinha}${formatBRL(item.valorTotal)}\n   📁 ${item.categoriaNome} · 📐 ${item.etapaNome}`;
    })
    .join("\n");
  const somaItens = itens.reduce((soma, item) => soma + item.valorTotal, 0);

  const texto =
    `*Confirme os dados da nota:*\n` +
    `🏢 Fornecedor: ${dados.fornecedorNome}\n` +
    `🏗️ Obra: ${dados.obraNome}\n\n` +
    `*Itens:*\n${linhasItens}\n\n` +
    `💰 Total: ${formatBRL(dados.notaValorTotal ?? somaItens)}`;

  await sendButtons(from, texto, [
    { id: "confirm:sim", title: "Confirmar" },
    { id: "confirm:nao", title: "Cancelar" },
  ]);
}

async function handleNotaConfirmacao(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (message.replyId === "confirm:nao") {
    await sendText(from, "🚫 Registro da nota cancelado.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId !== "confirm:sim") {
    await enviarConfirmacaoNota(from, session.dados_coletados as Dados);
    return;
  }

  const dados = session.dados_coletados as Dados;
  const autorNome = await getNomePorTelefone(from);
  const itens = dados.notaItensClassificados ?? [];
  const despesaIdsPagamento: string[] = [];

  // Move a sessao pra fora de NOTA_CONFIRMACAO ANTES de comecar a inserir -
  // se o usuario tocar "Confirmar" de novo (rede lenta, duplo toque) ou se
  // o loop quebrar no meio, um novo "confirm:sim" nao cai mais aqui e nao
  // relanca os itens que ja foram criados.
  await saveSession(from, ESTADOS.ANEXAR_PAGAMENTO_ARQUIVO, {
    despesaIdsPagamento: [],
  });

  try {
    for (const item of itens) {
      const ehMaterial = item.categoriaNome.toLowerCase() === "material";
      const material = ehMaterial
        ? await findOrCreateMaterial(item.descricao, item.categoriaId)
        : null;

      const despesa = await createDespesa({
        obraId: dados.obraId!,
        categoriaId: item.categoriaId,
        etapaId: item.etapaId,
        valor: item.valorTotal,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        materialId: material?.id ?? null,
        fornecedorId: dados.fornecedorId ?? null,
        criadoPorTelefone: from,
        criadoPorNome: autorNome,
        documentoAnexado:
        dados.comprovante?.tipoDocumento === "documento_cobranca" ||
        dados.comprovante?.tipoDocumento === "comprovante_pagamento"
          ? dados.comprovante.tipoDocumento
          : null,
      });
      if (dados.comprovante) {
        await vincularComprovanteDespesa({
          despesaId: despesa.id,
          comprovante: dados.comprovante,
        });
      }
      despesaIdsPagamento.push(despesa.id);

      await registrarAtividade({
        tipo: "criacao",
        entidade: "despesa",
        entidadeId: despesa.id,
        origem: "whatsapp",
        autorTelefone: from,
        autorNome,
        resumo: `Despesa de ${formatBRL(item.valorTotal)} (${item.descricao}, nota fiscal) registrada por ${autorNome}`,
        dadosDepois: item,
      });
    }
  } catch (error) {
    console.error("Erro ao registrar itens da nota:", error);
    await saveSession(from, ESTADOS.ANEXAR_PAGAMENTO_ARQUIVO, {
      despesaIdsPagamento,
    });
    await sendText(
      from,
      `⚠️ Deu um erro no meio do registro da nota. ${despesaIdsPagamento.length} de ${itens.length} item(ns) foram lançados com sucesso antes da falha - confira em Lançamentos e relance o restante manualmente se precisar.`
    );
    await sendMenuPrincipal(from);
    return;
  }

  await sendText(
    from,
    `✅ Nota registrada! ${itens.length} itens lançados na obra "${dados.obraNome}".`
  );
  await saveSession(from, ESTADOS.ANEXAR_PAGAMENTO_ARQUIVO, {
    despesaIdsPagamento,
  });
  await sendText(
    from,
    "💳 Se você já tiver o comprovante de pagamento dessa nota/conta, envie a imagem ou PDF agora. Vou vincular o pagamento aos lançamentos dessa nota. Se ainda não tiver, digite *pular* ou *menu*."
  );
}

// ---------- Orçamento (planilha) ----------

async function handleOrcamentoRecebido(from: string, media: IncomingMedia) {
  await sendText(from, "📊 Recebi a planilha de orçamento, analisando...");

  let orcamento;
  try {
    const { buffer } = await downloadWhatsAppMedia(media.id);
    const texto = extractSpreadsheetAsText(buffer);
    orcamento = await extractOrcamentoData(texto);
   } catch (error) {
    console.error("Erro ao processar orçamento:", error);
    orcamento = null;
  }

  if (!orcamento || orcamento.etapas.length === 0) {
    await sendText(
      from,
      "💰 Não consegui identificar as etapas nessa planilha. Confira se ela tem um resumo por etapa com os valores totais."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  const obras = await listObrasAtivas();
  if (obras.length === 0) {
    await sendText(
      from,
      "📭 Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra antes de importar um orçamento."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  const dados: Dados = {
    orcamentoEtapas: orcamento.etapas,
    orcamentoValorTotal: orcamento.valorTotal,
  };

  await saveSession(from, ESTADOS.ORCAMENTO_AGUARDANDO_OBRA, dados);
  await sendText(
    from,
    `🏗️ Encontrei ${orcamento.etapas.length} etapas nesse orçamento. Para qual obra devo importar?`
  );
  await sendListObras(from);
}

async function handleOrcamentoAguardandoObra(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const obraId = idSemPrefixo(message.replyId, "obra:");
  const obra = obraId
    ? await findObraById(obraId)
    : message.text
      ? await findObraPorTexto(message.text)
      : null;
  if (!obra) {
    await sendListObras(from);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    obraId: obra.id,
    obraNome: obra.nome,
  };
  await saveSession(from, ESTADOS.ORCAMENTO_CONFIRMACAO, dados);
  await enviarConfirmacaoOrcamento(from, dados);
}

async function enviarConfirmacaoOrcamento(from: string, dados: Dados) {
  const etapas = dados.orcamentoEtapas ?? [];
  const linhasEtapas = etapas
    .slice(0, 10)
    .map((e) => `• ${e.nome} — ${formatBRL(e.valorOrcado)}`)
    .join("\n");
  const somaEtapas = etapas.reduce((soma, e) => soma + e.valorOrcado, 0);
  const extra = etapas.length > 10 ? `\n... e mais ${etapas.length - 10} etapas` : "";

  const texto =
    `*Confirme a importação do orçamento:*\n` +
    `🏗️ Obra: ${dados.obraNome}\n\n` +
    `*Etapas:*\n${linhasEtapas}${extra}\n\n` +
    `💰 Orçamento Total: ${formatBRL(dados.orcamentoValorTotal ?? somaEtapas)}\n\n` +
    `⚠️ Isso substitui o orçamento e as etapas atuais dessa obra.`;

  await sendButtons(from, texto, [
    { id: "confirm:sim", title: "Confirmar" },
    { id: "confirm:nao", title: "Cancelar" },
  ]);
}

async function handleOrcamentoConfirmacao(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (message.replyId === "confirm:nao") {
    await sendText(from, "✨ Importação do orçamento cancelada.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId !== "confirm:sim") {
    await enviarConfirmacaoOrcamento(from, session.dados_coletados as Dados);
    return;
  }

  const dados = session.dados_coletados as Dados;
  await upsertEtapasDeObra(dados.obraId!, dados.orcamentoEtapas ?? []);

  const autorNome = await getNomePorTelefone(from);
  await registrarAtividade({
    tipo: "edicao",
    entidade: "orcamento",
    entidadeId: dados.obraId,
    origem: "whatsapp",
    autorTelefone: from,
    autorNome,
    resumo: `Orçamento importado via WhatsApp para a obra "${dados.obraNome}" (${dados.orcamentoEtapas?.length ?? 0} etapas) por ${autorNome}`,
    dadosDepois: { etapas: dados.orcamentoEtapas },
  });

  await sendText(
    from,
    `✅ Orçamento importado! ${dados.orcamentoEtapas?.length ?? 0} etapas cadastradas na obra "${dados.obraNome}".`
  );
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function registrarEdicaoDespesa(
  from: string,
  dados: Dados,
  resumoAlteracao: string,
  dadosDepois: unknown
) {
  const autorNome = await getNomePorTelefone(from);
  await registrarAtividade({
    tipo: "edicao",
    entidade: "despesa",
    entidadeId: dados.despesaId,
    origem: "whatsapp",
    autorTelefone: from,
    autorNome,
    resumo: `${resumoAlteracao} (despesa de ${formatBRL(dados.despesaAntes?.valor ?? 0)}) por ${autorNome}`,
    dadosAntes: dados.despesaAntes,
    dadosDepois,
  });
}

// ---------- Conta a Pagar ----------

async function iniciarContaAPagar(from: string) {
  await saveSession(from, ESTADOS.CONTA_A_PAGAR_ARQUIVO, {});
  await sendText(
    from,
    "📅 Manda a foto/PDF da conta (boleto, luz, aluguel...), ou digite *manual* pra digitar os dados na mão."
  );
}

async function handleContaAPagarArquivoTexto(from: string, message: IncomingMessage) {
  const texto = message.text?.trim().toLowerCase();
  if (texto === "manual") {
    await saveSession(from, ESTADOS.CONTA_A_PAGAR_DESCRICAO, {});
    await sendText(from, "📝 Descreva a conta (ex: Aluguel da sala, Conta de luz):");
    return;
  }
  await sendText(
    from,
    "📅 Manda a foto/PDF da conta, ou digite *manual* pra digitar os dados na mão."
  );
}

async function handleContaAPagarArquivoRecebido(from: string, media: IncomingMedia) {
  await sendText(from, "📅 Recebi a conta, analisando...");

  try {
    const { buffer, mimeType } = await downloadWhatsAppMedia(media.id);
    const extraido = await extractInvoiceData(buffer, mimeType);
    const arquivo = await uploadComprovanteWhatsApp({
      telefone: from,
      mediaId: media.id,
      buffer,
      mimeType,
      tipoDocumento: "documento_cobranca",
    });

    const dados: Dados = {
      contaAPagarDescricao: extraido?.fornecedorNome && extraido.fornecedorNome !== "Não identificado"
        ? extraido.fornecedorNome
        : extraido?.itens?.[0]?.descricao ?? "Conta",
      contaAPagarValor: extraido?.valorTotalNota ?? extraido?.itens?.[0]?.valorTotal ?? undefined,
      contaAPagarVencimento: extraido?.dataVencimento ?? undefined,
      contaAPagarArquivo: { bucket: arquivo.bucket, path: arquivo.path, mimeType: arquivo.mimeType, nomeArquivo: arquivo.nomeArquivo },
    };

    if (!dados.contaAPagarValor) {
      await saveSession(from, ESTADOS.CONTA_A_PAGAR_DESCRICAO, dados);
      await sendText(
        from,
        "📅 Não consegui identificar o valor nessa imagem. Digite a descrição da conta pra continuarmos manualmente:"
      );
      return;
    }

    if (!dados.contaAPagarVencimento) {
      await saveSession(from, ESTADOS.CONTA_A_PAGAR_VENCIMENTO, dados);
      await sendText(
        from,
        `💰 Valor identificado: ${formatBRL(dados.contaAPagarValor)}\n📆 Não achei a data de vencimento. Digite ela (ex: 05/09/2026):`
      );
      return;
    }

    await saveSession(from, ESTADOS.CONTA_A_PAGAR_CONFIRMACAO, dados);
    await sendButtons(
      from,
      `📅 *Identifiquei uma conta a pagar*\n💰 Valor: ${formatBRL(dados.contaAPagarValor)}\n📝 Descrição: ${dados.contaAPagarDescricao}\n📆 Vencimento: ${formatDataBR(dados.contaAPagarVencimento)}\n\nEstá correto?`,
      [
        { id: "confirm:sim", title: "Confirmar" },
        { id: "confirm:nao", title: "Cancelar" },
      ]
    );
  } catch (error) {
    console.error("Erro ao processar conta a pagar:", error);
    Sentry.captureException(error);
    await sendText(
      from,
      "📅 Não consegui ler essa imagem. Digite *manual* pra cadastrar a conta digitando os dados."
    );
  }
}

async function handleContaAPagarDescricao(from: string, message: IncomingMessage, session: Session) {
  if (!message.text) {
    await sendText(from, "📝 Digite a descrição da conta.");
    return;
  }
  const dados: Dados = { ...session.dados_coletados, contaAPagarDescricao: message.text.trim() };
  await saveSession(from, ESTADOS.CONTA_A_PAGAR_VALOR, dados);
  await sendText(from, "💰 Qual o valor? (ex: 1500,00)");
}

async function handleContaAPagarValorManual(from: string, message: IncomingMessage, session: Session) {
  const valor = message.text ? parseValorBR(message.text) : null;
  if (valor === null) {
    await sendText(from, "💰 Não entendi o valor. Digite apenas o número, ex: 1500,00");
    return;
  }
  const dados: Dados = { ...session.dados_coletados, contaAPagarValor: valor };
  await saveSession(from, ESTADOS.CONTA_A_PAGAR_VENCIMENTO, dados);
  await sendText(from, "📆 Qual a data de vencimento? (ex: 05/09/2026)");
}

function parseDataBR(texto: string): string | null {
  const match = texto.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const dia = Number(match[1]);
  const mes = Number(match[2]);
  let ano = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (ano < 100) ano += 2000;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

async function handleContaAPagarVencimento(from: string, message: IncomingMessage, session: Session) {
  const vencimento = message.text ? parseDataBR(message.text) : null;
  if (!vencimento) {
    await sendText(from, "📆 Não entendi a data. Digite no formato dd/mm/aaaa, ex: 05/09/2026");
    return;
  }
  const dados: Dados = { ...session.dados_coletados, contaAPagarVencimento: vencimento };

  if (!dados.contaAPagarValor || !dados.contaAPagarDescricao) {
    await saveSession(from, ESTADOS.CONTA_A_PAGAR_OBRA, dados);
    await sendListObrasParaContaAPagar(from);
    return;
  }

  await saveSession(from, ESTADOS.CONTA_A_PAGAR_CONFIRMACAO, dados);
  await sendButtons(
    from,
    `📅 *Confirma a conta a pagar?*\n💰 Valor: ${formatBRL(dados.contaAPagarValor)}\n📝 Descrição: ${dados.contaAPagarDescricao}\n📆 Vencimento: ${formatDataBR(vencimento)}`,
    [
      { id: "confirm:sim", title: "Confirmar" },
      { id: "confirm:nao", title: "Cancelar" },
    ]
  );
}

async function handleContaAPagarConfirmacao(from: string, message: IncomingMessage, session: Session) {
  const dados = session.dados_coletados as Dados;
  if (message.replyId === "confirm:nao") {
    await sendText(from, "🚫 Cadastro cancelado.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }
  if (message.replyId !== "confirm:sim") {
    await sendButtons(from, "Está correto?", [
      { id: "confirm:sim", title: "Confirmar" },
      { id: "confirm:nao", title: "Cancelar" },
    ]);
    return;
  }
  await saveSession(from, ESTADOS.CONTA_A_PAGAR_OBRA, dados);
  await sendListObrasParaContaAPagar(from);
}

async function handleContaAPagarObra(from: string, message: IncomingMessage, session: Session) {
  const dados = session.dados_coletados as Dados;
  const texto = message.text?.trim();

  if (texto === "0") {
    await saveSession(from, ESTADOS.CONTA_A_PAGAR_RECORRENCIA, {
      ...dados,
      contaAPagarObraId: null,
      contaAPagarObraNome: null,
    });
    await sendButtonsRecorrencia(from);
    return;
  }

  const obra = message.text ? await findObraPorTexto(message.text) : null;
  if (!obra) {
    await sendListObrasParaContaAPagar(from);
    return;
  }

  await saveSession(from, ESTADOS.CONTA_A_PAGAR_RECORRENCIA, {
    ...dados,
    contaAPagarObraId: obra.id,
    contaAPagarObraNome: obra.nome,
  });
  await sendButtonsRecorrencia(from);
}

async function handleContaAPagarRecorrencia(from: string, message: IncomingMessage, session: Session) {
  const dados = session.dados_coletados as Dados;
  const mapa: Record<string, "nenhuma" | "semanal" | "mensal"> = {
    [RECORRENCIA_IDS.NENHUMA]: "nenhuma",
    [RECORRENCIA_IDS.SEMANAL]: "semanal",
    [RECORRENCIA_IDS.MENSAL]: "mensal",
  };
  const recorrencia = message.replyId ? mapa[message.replyId] : undefined;
  if (!recorrencia) {
    await sendButtonsRecorrencia(from);
    return;
  }

  await saveSession(from, ESTADOS.CONTA_A_PAGAR_DIAS_AVISO, { ...dados, contaAPagarRecorrencia: recorrencia });
  await sendListDiasAviso(from);
}

async function handleContaAPagarDiasAviso(from: string, message: IncomingMessage, session: Session) {
  const dados = session.dados_coletados as Dados;
  const texto = message.text?.trim();

  let dias: number | null = null;
  if (texto === "1") dias = 1;
  else if (texto === "2") dias = 3;
  else if (texto === "3") dias = 7;
  else if (texto === "4") dias = -1;
  else if (texto && /^\d+$/.test(texto)) dias = Number(texto);

  if (dias === null) {
    await sendListDiasAviso(from);
    return;
  }

  await finalizarContaAPagar(from, dados, dias);
}

async function finalizarContaAPagar(from: string, dados: Dados, avisarDiasAntes: number) {
  const autorNome = await getNomePorTelefone(from);

  const id = await criarContaAPagar({
    descricao: dados.contaAPagarDescricao!,
    valor: dados.contaAPagarValor!,
    dataVencimento: dados.contaAPagarVencimento!,
    obraId: dados.contaAPagarObraId ?? null,
    recorrencia: dados.contaAPagarRecorrencia ?? "nenhuma",
    avisarDiasAntes,
    arquivo: dados.contaAPagarArquivo ?? null,
    criadoPor: autorNome,
  });

  if (!id) {
    await sendText(from, "⚠️ Não consegui salvar essa conta a pagar. Tente de novo.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await registrarAtividade({
    tipo: "criacao",
    entidade: "conta_a_pagar",
    entidadeId: id,
    origem: "whatsapp",
    autorTelefone: from,
    autorNome,
    resumo: `Conta a pagar "${dados.contaAPagarDescricao}" (${formatBRL(dados.contaAPagarValor ?? 0)}) cadastrada por ${autorNome}`,
    dadosDepois: dados,
  });

  const partes = [
    "✅ Conta a pagar cadastrada!",
    `📝 ${dados.contaAPagarDescricao}`,
    `💰 ${formatBRL(dados.contaAPagarValor ?? 0)}`,
    `📆 Vence ${formatDataBR(dados.contaAPagarVencimento!)}`,
    dados.contaAPagarObraNome ? `🏗️ ${dados.contaAPagarObraNome}` : "🏢 Sem obra (Administrativo)",
    avisarDiasAntes >= 0 ? `🔔 Aviso ${avisarDiasAntes} dia(s) antes` : "🔕 Sem aviso antecipado",
  ];
  await sendText(from, partes.join("\n"));
  await resetSession(from);
  await sendMenuPrincipal(from);
}

// ---------- Corrigir Lançamento ----------

async function iniciarCorrecaoLancamento(from: string) {
  const despesas = await listDespesasRecentes(10);

  if (despesas.length === 0) {
    await sendText(from, "📭 Nenhuma despesa registrada ainda.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await saveSession(from, ESTADOS.CORRIGIR_SELECIONANDO_LANCAMENTO, {});
  await sendListDespesasRecentes(from);
}

async function handleCorrigirSelecionandoLancamento(
  from: string,
  message: IncomingMessage
) {
  const { despesa, jaRespondeu } = await resolverDespesaDaMensagem(from, message);
  if (jaRespondeu) return;
  if (!despesa) {
    await sendListDespesasRecentes(from);
    return;
  }

  const dados: Dados = { despesaId: despesa.id, despesaAntes: despesa };
  await saveSession(from, ESTADOS.CORRIGIR_SELECIONANDO_CAMPO, dados);
  await sendText(
    from,
    `*Despesa selecionada:*\n` +
      `💰 Valor: ${formatBRL(despesa.valor)}\n` +
      `🏗️ Obra: ${despesa.obraNome}\n` +
      `📁 Categoria: ${despesa.categoriaNome}\n` +
      `📐 Etapa: ${despesa.etapaNome}\n` +
      `📦 Material: ${despesa.materialNome ?? "?"}
` +
      `🏢 Fornecedor: ${despesa.fornecedorNome ?? "?"}
` +
      `📝 Descrição: ${despesa.descricao ?? "?"}`
  );
  await sendListCamposParaCorrigir(from);
}

async function handleCorrigirSelecionandoCampo(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const dados = session.dados_coletados as Dados;

  switch (message.replyId) {
    case CAMPO_IDS.VALOR:
      await saveSession(from, ESTADOS.CORRIGIR_VALOR_NOVO, dados);
      await sendText(from, "💰 Qual o novo valor? (ex: 150,00)");
      return;
    case CAMPO_IDS.DESCRICAO:
      await saveSession(from, ESTADOS.CORRIGIR_DESCRICAO_NOVA, dados);
      await sendText(from, "⌨️ Digite a nova descrição:");
      return;
    case CAMPO_IDS.CATEGORIA:
      await saveSession(from, ESTADOS.CORRIGIR_CATEGORIA_NOVA, dados);
      await sendListCategorias(from);
      return;
    case CAMPO_IDS.ETAPA: {
      const despesa = await findDespesaCompletaById(dados.despesaId!);
      if (!despesa?.obraId) {
        await sendText(from, "📐 Essa despesa não tem obra vinculada, não há etapa pra definir.");
        await sendListCamposParaCorrigir(from);
        return;
      }
      await saveSession(from, ESTADOS.CORRIGIR_ETAPA_NOVA, dados);
      await sendListEtapas(from, despesa.obraId);
      return;
    }
    case CAMPO_IDS.MATERIAL:
      await saveSession(from, ESTADOS.CORRIGIR_MATERIAL_NOVO, dados);
      await sendListMateriaisParaDespesa(from);
      return;
    case CAMPO_IDS.FORNECEDOR:
      await saveSession(from, ESTADOS.CORRIGIR_FORNECEDOR_NOVO, dados);
      await sendListFornecedores(from);
      return;
    case CAMPO_IDS.EXCLUIR:
      await saveSession(from, ESTADOS.CORRIGIR_CONFIRMAR_EXCLUSAO, dados);
      await sendButtons(from, "⚠️ Tem certeza que deseja excluir essa despesa?", [
        { id: "confirm:sim", title: "Excluir" },
        { id: "confirm:nao", title: "Cancelar" },
      ]);
      return;
    default:
      await sendListCamposParaCorrigir(from);
  }
}

async function handleCorrigirValorNovo(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (!message.text) {
    await sendText(from, "💰 Digite o novo valor.");
    return;
  }
  const valor = parseValorBR(message.text);
  if (valor === null) {
    await sendText(from, "💰 Não entendi o valor. Digite apenas o número, ex: 150,00");
    return;
  }

  const dados = session.dados_coletados as Dados;
  await updateDespesaCampo(dados.despesaId!, { valor });
  await registrarEdicaoDespesa(from, dados, `Valor alterado para ${formatBRL(valor)}`, { valor });
  await sendText(from, "✅ Valor atualizado.");
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleCorrigirDescricaoNova(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (!message.text) {
    await sendText(from, "⌨️ Digite a nova descrição.");
    return;
  }

  const dados = session.dados_coletados as Dados;
  await updateDespesaCampo(dados.despesaId!, { descricao: message.text });
  await registrarEdicaoDespesa(from, dados, `Descrição alterada para "${message.text}"`, {
    descricao: message.text,
  });
  await sendText(from, "✅ Descrição atualizada.");
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleCorrigirCategoriaNova(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const categoriaId = idSemPrefixo(message.replyId, "categoria:");
  const categoria = categoriaId
    ? await findCategoriaById(categoriaId)
    : message.text
      ? await findCategoriaPorTexto(message.text)
      : null;
  if (!categoria) {
    await sendListCategorias(from);
    return;
  }

  const dados = session.dados_coletados as Dados;
  await updateDespesaCampo(dados.despesaId!, { categoria_id: categoria.id });
  await registrarEdicaoDespesa(
    from,
    dados,
    `Categoria alterada para "${categoria.nome}"`,
    { categoriaId: categoria.id, categoriaNome: categoria.nome }
  );
  await sendText(from, `✅ Categoria atualizada para "${categoria.nome}".`);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleCorrigirEtapaNova(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const dados = session.dados_coletados as Dados;
  const despesa = await findDespesaCompletaById(dados.despesaId!);
  if (!despesa?.obraId) {
    await sendText(from, "📐 Essa despesa não tem obra vinculada, não há etapa pra definir.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }
  const etapa = await resolverEtapaDaMensagem(message, despesa.obraId);

  if (!etapa) {
    await sendListEtapas(from, despesa.obraId);
    return;
  }

  await updateDespesaCampo(dados.despesaId!, { etapa_id: etapa.id });
  await registrarEdicaoDespesa(from, dados, `Etapa alterada para "${etapa.nome}"`, {
    etapaId: etapa.id,
    etapaNome: etapa.nome,
  });
  await sendText(from, `✅ Etapa atualizada para "${etapa.nome}".`);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleCorrigirMaterialNovo(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const materialId = idSemPrefixo(message.replyId, "material:");
  const material = materialId
    ? await findMaterialById(materialId)
    : message.text
      ? await findMaterialPorTexto(message.text)
      : null;
  const dados = session.dados_coletados as Dados;

  if (!material) {
    await sendListMateriaisParaDespesa(from);
    return;
  }

  await updateDespesaCampo(dados.despesaId!, {
    material_id: material.id,
    descricao: material.nome,
  });
  await registrarEdicaoDespesa(from, dados, `Material alterado para "${material.nome}"`, {
    materialId: material.id,
    materialNome: material.nome,
  });
  await sendText(from, `✅ Material atualizado para "${material.nome}".`);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleCorrigirFornecedorNovo(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const fornecedorId = idSemPrefixo(message.replyId, "fornecedor:");
  const fornecedor = fornecedorId
    ? await findFornecedorById(fornecedorId)
    : message.text
      ? await findFornecedorPorTexto(message.text)
      : null;
  if (!fornecedor) {
    await sendListFornecedores(from);
    return;
  }

  const dados = session.dados_coletados as Dados;
  await updateDespesaCampo(dados.despesaId!, { fornecedor_id: fornecedor.id });
  await registrarEdicaoDespesa(
    from,
    dados,
    `Fornecedor alterado para "${fornecedor.nome}"`,
    { fornecedorId: fornecedor.id, fornecedorNome: fornecedor.nome }
  );
  await sendText(from, `✅ Fornecedor atualizado para "${fornecedor.nome}".`);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleCorrigirConfirmarExclusao(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const dados = session.dados_coletados as Dados;

  if (message.replyId === "confirm:sim") {
    await deleteDespesaPorId(dados.despesaId!);
    const autorNome = await getNomePorTelefone(from);
    await registrarAtividade({
      tipo: "exclusao",
      entidade: "despesa",
      entidadeId: dados.despesaId,
      origem: "whatsapp",
      autorTelefone: from,
      autorNome,
      resumo: `Despesa de ${formatBRL(dados.despesaAntes?.valor ?? 0)} (${dados.despesaAntes?.categoriaNome ?? "—"}) excluída por ${autorNome}`,
      dadosAntes: dados.despesaAntes,
    });
    await sendText(from, "🗑️ Despesa excluída.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId === "confirm:nao") {
    await sendText(from, "✅ Ok, mantido sem alterações.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await sendButtons(from, "⚠️ Tem certeza que deseja excluir essa despesa?", [
    { id: "confirm:sim", title: "Excluir" },
    { id: "confirm:nao", title: "Cancelar" },
  ]);
}

// ---------- Remover Cadastro (Obra / Material / Fornecedor) ----------

const TIPO_REMOVER_LABEL: Record<NonNullable<Dados["tipoRemover"]>, string> = {
  obra: "obra",
  material: "material",
  fornecedor: "fornecedor",
};

async function iniciarRemoverCadastro(from: string) {
  await saveSession(from, ESTADOS.REMOVER_TIPO, {});
  await sendButtons(from, "🗑️ O que você deseja remover?", [
    { id: TIPO_REMOVER_IDS.OBRA, title: "Obra" },
    { id: TIPO_REMOVER_IDS.MATERIAL, title: "Material" },
    { id: TIPO_REMOVER_IDS.FORNECEDOR, title: "Fornecedor" },
  ]);
}

async function enviarListaParaRemover(
  from: string,
  tipo: NonNullable<Dados["tipoRemover"]>
) {
  if (tipo === "obra") await sendListObras(from);
  if (tipo === "material") await sendListMateriais(from);
  if (tipo === "fornecedor") await sendListFornecedores(from);
}

async function handleRemoverTipo(from: string, message: IncomingMessage) {
  let tipo: Dados["tipoRemover"];
  if (message.replyId === TIPO_REMOVER_IDS.OBRA) tipo = "obra";
  else if (message.replyId === TIPO_REMOVER_IDS.MATERIAL) tipo = "material";
  else if (message.replyId === TIPO_REMOVER_IDS.FORNECEDOR) tipo = "fornecedor";

  if (!tipo) {
    await iniciarRemoverCadastro(from);
    return;
  }

  const [obras, materiais, fornecedores] = await Promise.all([
    tipo === "obra" ? listObrasAtivas() : Promise.resolve([]),
    tipo === "material" ? listMateriais() : Promise.resolve([]),
    tipo === "fornecedor" ? listFornecedores() : Promise.resolve([]),
  ]);
  const itens =
    tipo === "obra" ? obras : tipo === "material" ? materiais : fornecedores;

  if (itens.length === 0) {
    await sendText(from, `📭 Nenhum(a) ${TIPO_REMOVER_LABEL[tipo]} cadastrado(a) ainda.`);
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await saveSession(from, ESTADOS.REMOVER_SELECIONANDO_ITEM, { tipoRemover: tipo });
  await enviarListaParaRemover(from, tipo);
}

async function handleRemoverSelecionandoItem(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const dados = session.dados_coletados as Dados;
  const tipo = dados.tipoRemover!;
  const prefixo = `${tipo}:`;
  const itemId = idSemPrefixo(message.replyId, prefixo);

  const item = itemId
    ? tipo === "obra"
      ? await findObraById(itemId)
      : tipo === "material"
        ? await findMaterialById(itemId)
        : await findFornecedorById(itemId)
    : message.text
      ? tipo === "obra"
        ? await findObraPorTexto(message.text)
        : tipo === "material"
          ? await findMaterialPorTexto(message.text)
          : await findFornecedorPorTexto(message.text)
      : null;

  if (!item) {
    await enviarListaParaRemover(from, tipo);
    return;
  }

  const novosDados: Dados = {
    tipoRemover: tipo,
    itemRemoverId: item.id,
    itemRemoverNome: item.nome,
  };
  await saveSession(from, ESTADOS.REMOVER_CONFIRMACAO, novosDados);

  const aviso =
    tipo === "obra"
      ? "⚠️ Isso vai apagar a obra e TODAS as despesas e etapas registradas nela. Essa ação não pode ser desfeita."
      : "Essa ação não pode ser desfeita.";

  await sendButtons(
    from,
    `🗑️ Remover ${TIPO_REMOVER_LABEL[tipo]} "${item.nome}"?\n${aviso}`,
    [
      { id: "confirm:sim", title: "Remover" },
      { id: "confirm:nao", title: "Cancelar" },
    ]
  );
}

async function handleRemoverConfirmacao(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const dados = session.dados_coletados as Dados;

  if (message.replyId === "confirm:nao") {
    await sendText(from, "✅ Ok, nada foi removido.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId !== "confirm:sim") {
    await sendButtons(
      from,
      `🗑️ Remover ${TIPO_REMOVER_LABEL[dados.tipoRemover!]} "${dados.itemRemoverNome}"?`,
      [
        { id: "confirm:sim", title: "Remover" },
        { id: "confirm:nao", title: "Cancelar" },
      ]
    );
    return;
  }

  try {
    if (dados.tipoRemover === "obra") await deleteObraPorId(dados.itemRemoverId!);
    if (dados.tipoRemover === "material") await deleteMaterialPorId(dados.itemRemoverId!);
    if (dados.tipoRemover === "fornecedor") await deleteFornecedorPorId(dados.itemRemoverId!);

    const autorNome = await getNomePorTelefone(from);
    await registrarAtividade({
      tipo: "exclusao",
      entidade: dados.tipoRemover!,
      entidadeId: dados.itemRemoverId,
      origem: "whatsapp",
      autorTelefone: from,
      autorNome,
      resumo: `${TIPO_REMOVER_LABEL[dados.tipoRemover!]} "${dados.itemRemoverNome}" removido(a) por ${autorNome}`,
      dadosAntes: { nome: dados.itemRemoverNome },
    });

    await sendText(
      from,
      `🗑️ ${TIPO_REMOVER_LABEL[dados.tipoRemover!]} "${dados.itemRemoverNome}" removido(a) com sucesso.`
    );
   } catch (error) {
    console.error("Erro ao remover cadastro:", error);
    await sendText(
      from,
      `🗑️ Não consegui remover "${dados.itemRemoverNome}". Provavelmente existem despesas vinculadas a esse cadastro — corrija ou remova essas despesas primeiro (menu "Corrigir Lançamento").`
    );
  }

  await resetSession(from);
  await sendMenuPrincipal(from);
}
