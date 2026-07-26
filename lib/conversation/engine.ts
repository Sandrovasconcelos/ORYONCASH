import type { IncomingMessage, IncomingMedia } from "@/lib/whatsapp/parse";
import { sendText, sendButtons } from "@/lib/whatsapp/messages";
import { getSession, saveSession, resetSession, type Session } from "@/lib/whatsapp/session";
import { downloadWhatsAppMedia } from "@/lib/whatsapp/media";
import { extractInvoiceData, type InvoiceItem } from "@/lib/gemini/extractInvoice";
import { extractOrcamentoData, type OrcamentoEtapa } from "@/lib/gemini/extractOrcamento";
import { extractDespesaDeAudio } from "@/lib/gemini/extractDespesaAudio";
import { extractSpreadsheetAsText } from "@/lib/orcamento/parseSpreadsheet";
import { formatBRL, parseValorBR } from "./format";
import { ESTADOS, MENU_IDS, CAMPO_IDS, TIPO_REMOVER_IDS, COMANDOS_CANCELAR } from "./states";
import { sendMenuPrincipal } from "./menu";
import {
  sendListObras,
  sendListCategorias,
  sendListEtapas,
  sendListFornecedores,
  sendListDespesasRecentes,
  sendListCamposParaCorrigir,
  sendListMateriais,
} from "./lists";
import {
  findObraById,
  findCategoriaById,
  findEtapaById,
  listObrasAtivas,
  createObra,
  createMaterial,
  createFornecedor,
  createDespesa,
  getObraResumo,
  findCategoriaMaterial,
  findOrCreateMaterial,
  findOrCreateFornecedorPorNota,
  upsertEtapasDeObra,
  findFornecedorById,
  findDespesaCompletaById,
  updateDespesaCampo,
  deleteDespesaPorId,
  listDespesasRecentes,
  listMateriais,
  findMaterialById,
  deleteObraPorId,
  deleteMaterialPorId,
  deleteFornecedorPorId,
  listFornecedores,
} from "./queries";

const MIME_TYPES_PLANILHA = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

type Dados = {
  valor?: number;
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

  orcamentoEtapas?: OrcamentoEtapa[];
  orcamentoValorTotal?: number | null;

  despesaId?: string;

  tipoRemover?: "obra" | "material" | "fornecedor";
  itemRemoverId?: string;
  itemRemoverNome?: string;
};

function idSemPrefixo(replyId: string | null, prefixo: string): string | null {
  if (!replyId || !replyId.startsWith(prefixo)) return null;
  return replyId.slice(prefixo.length);
}

export async function handleIncomingMessage(message: IncomingMessage) {
  const { from } = message;

  if (message.media) {
    if (MIME_TYPES_PLANILHA.includes(message.media.mimeType)) {
      return handleOrcamentoRecebido(from, message.media);
    }
    if (message.media.mimeType.startsWith("audio/")) {
      return handleAudioRecebido(from, message.media);
    }
    return handleNotaFiscalRecebida(from, message.media);
  }

  const textoNormalizado = message.text?.trim().toLowerCase();

  if (textoNormalizado && COMANDOS_CANCELAR.includes(textoNormalizado)) {
    await resetSession(from);
    await sendText(from, "Ok, voltando ao menu principal.");
    await sendMenuPrincipal(from);
    return;
  }

  const session = await getSession(from);

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
    case ESTADOS.DESPESA_DESCRICAO_PROMPT:
      return handleDespesaDescricaoPrompt(from, message, session);
    case ESTADOS.DESPESA_DESCRICAO_TEXTO:
      return handleDespesaDescricaoTexto(from, message, session);
    case ESTADOS.DESPESA_CONFIRMACAO:
      return handleDespesaConfirmacao(from, message, session);

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

    case ESTADOS.NOTA_AGUARDANDO_OBRA:
      return handleNotaAguardandoObra(from, message, session);
    case ESTADOS.NOTA_AGUARDANDO_ETAPA:
      return handleNotaAguardandoEtapa(from, message, session);
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
      await sendText(from, "Qual o valor da despesa? (ex: 150,00)");
      return;
    case MENU_IDS.CADASTRAR_OBRA:
      await saveSession(from, ESTADOS.CADASTRO_OBRA_NOME, {});
      await sendText(from, "Qual o nome da obra?");
      return;
    case MENU_IDS.CADASTRAR_MATERIAL:
      await saveSession(from, ESTADOS.CADASTRO_MATERIAL_NOME, {});
      await sendText(from, "Qual o nome do material? (Ex: Cimento CP-II 50kg)");
      return;
    case MENU_IDS.CADASTRAR_FORNECEDOR:
      await saveSession(from, ESTADOS.CADASTRO_FORNECEDOR_NOME, {});
      await sendText(from, "Qual o nome do fornecedor?");
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
    default:
      await sendMenuPrincipal(from);
  }
}

async function iniciarVerResumo(from: string) {
  const obras = await listObrasAtivas();

  if (obras.length === 0) {
    await sendText(
      from,
      "Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra primeiro."
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
    await sendText(from, "Não encontrei essa obra.");
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
  if (!obraId) {
    await sendListObras(from);
    return;
  }
  await enviarResumoObra(from, obraId);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

// ---------- Registrar Despesa ----------

async function handleDespesaValor(from: string, message: IncomingMessage) {
  if (!message.text) {
    await sendText(from, "Por favor, digite o valor da despesa (ex: 150,00).");
    return;
  }

  const valor = parseValorBR(message.text);
  if (valor === null) {
    await sendText(
      from,
      "Não entendi o valor. Digite apenas o número, ex: 150,00"
    );
    return;
  }

  const obras = await listObrasAtivas();
  if (obras.length === 0) {
    await sendText(
      from,
      "Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra antes de registrar despesas."
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
  const obra = obraId ? await findObraById(obraId) : null;
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
  const categoria = categoriaId ? await findCategoriaById(categoriaId) : null;
  if (!categoria) {
    await sendListCategorias(from);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    categoriaId: categoria.id,
    categoriaNome: categoria.nome,
  };
  await saveSession(from, ESTADOS.DESPESA_ETAPA, dados);
  await sendListEtapas(from, dados.obraId!);
}

async function handleDespesaEtapa(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const etapaId = idSemPrefixo(message.replyId, "etapa:");
  const etapa = etapaId ? await findEtapaById(etapaId) : null;
  if (!etapa) {
    await sendListEtapas(from, (session.dados_coletados as Dados).obraId!);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    etapaId: etapa.id,
    etapaNome: etapa.nome,
  };

  // Se a descricao ja veio preenchida (extraida por IA de audio/comprovante),
  // nao pergunta de novo - vai direto pra confirmacao.
  if (dados.descricao) {
    await saveSession(from, ESTADOS.DESPESA_CONFIRMACAO, dados);
    await enviarConfirmacao(from, dados);
    return;
  }

  if (dados.categoriaNome?.toLowerCase() === "material") {
    await saveSession(from, ESTADOS.DESPESA_DESCRICAO_TEXTO, dados);
    await sendText(
      from,
      "Qual o tipo de material? (ex: Cabo elétrico 2,5mm, Cimento CP-II 50kg, Areia média)"
    );
    return;
  }

  await saveSession(from, ESTADOS.DESPESA_DESCRICAO_PROMPT, dados);
  await sendButtons(from, "Deseja adicionar uma descrição para esta despesa?", [
    { id: "desc:add", title: "Adicionar" },
    { id: "desc:skip", title: "Pular" },
  ]);
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
      "Digite a descrição da despesa:\n(Ex: Compra de cimento, Pagamento pedreiro, etc.)"
    );
    return;
  }

  if (message.replyId === "desc:skip") {
    const dados: Dados = { ...session.dados_coletados, descricao: null };
    await saveSession(from, ESTADOS.DESPESA_CONFIRMACAO, dados);
    await enviarConfirmacao(from, dados);
    return;
  }

  await sendButtons(from, "Deseja adicionar uma descrição para esta despesa?", [
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
    await sendText(from, "Digite a descrição da despesa.");
    return;
  }

  const dados: Dados = { ...session.dados_coletados, descricao: message.text };
  await saveSession(from, ESTADOS.DESPESA_CONFIRMACAO, dados);
  await enviarConfirmacao(from, dados);
}

async function enviarConfirmacao(from: string, dados: Dados) {
  let texto =
    `*Confirme os dados:*\n` +
    `💰 Valor: ${formatBRL(dados.valor!)}\n` +
    `🏗️ Obra: ${dados.obraNome}\n` +
    `📁 Categoria: ${dados.categoriaNome}\n` +
    `📐 Etapa: ${dados.etapaNome}`;

  if (dados.fornecedorNome) {
    texto += `\n🏢 Fornecedor: ${dados.fornecedorNome}`;
  }
  if (dados.descricao) {
    texto += `\n📝 Descrição: ${dados.descricao}`;
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
    await createDespesa({
      obraId: dados.obraId!,
      categoriaId: dados.categoriaId!,
      etapaId: dados.etapaId!,
      valor: dados.valor!,
      descricao: dados.descricao ?? null,
      fornecedorId: dados.fornecedorId ?? null,
    });
    await sendText(from, "✅ Despesa registrada com sucesso!");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId === "confirm:nao") {
    await sendText(from, "Despesa cancelada.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  await enviarConfirmacao(from, session.dados_coletados);
}

// ---------- Cadastrar Obra ----------

async function handleCadastroObraNome(from: string, message: IncomingMessage) {
  if (!message.text) {
    await sendText(from, "Qual o nome da obra?");
    return;
  }
  await saveSession(from, ESTADOS.CADASTRO_OBRA_ORCAMENTO, { nome: message.text });
  await sendText(from, "Qual o orçamento total dessa obra? (ex: 500000,00)");
}

async function handleCadastroObraOrcamento(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (!message.text) {
    await sendText(from, "Qual o orçamento total dessa obra? (ex: 500000,00)");
    return;
  }
  const valor = parseValorBR(message.text);
  if (valor === null) {
    await sendText(from, "Não entendi o valor. Digite apenas o número, ex: 500000,00");
    return;
  }

  const nome = session.dados_coletados.nome as string;
  await createObra(nome, valor);
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
    await sendText(from, "Qual o nome do material?");
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
  const categoria = categoriaId ? await findCategoriaById(categoriaId) : null;
  if (!categoria) {
    await sendListCategorias(from);
    return;
  }

  const nome = session.dados_coletados.nome as string;
  await createMaterial(nome, categoria.id);
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
    await sendText(from, "Qual o nome do fornecedor?");
    return;
  }
  await saveSession(from, ESTADOS.CADASTRO_FORNECEDOR_CONTATO, {
    nome: message.text,
  });
  await sendText(
    from,
    "Qual o contato do fornecedor (telefone)? Digite 'pular' se não quiser informar."
  );
}

async function handleCadastroFornecedorContato(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  if (!message.text) {
    await sendText(from, "Digite o contato do fornecedor ou 'pular'.");
    return;
  }

  const contato = message.text.trim().toLowerCase() === "pular" ? null : message.text;
  const nome = session.dados_coletados.nome as string;
  await createFornecedor(nome, contato);
  await sendText(from, `✅ Fornecedor "${nome}" cadastrado.`);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

// ---------- Nota Fiscal / Comprovante / Áudio ----------

async function handleNotaFiscalRecebida(from: string, media: IncomingMedia) {
  await sendText(from, "📄 Recebi seu comprovante, analisando...");

  let invoice;
  try {
    const { buffer, mimeType } = await downloadWhatsAppMedia(media.id);
    invoice = await extractInvoiceData(buffer, mimeType);
  } catch (error) {
    console.error("Erro ao processar comprovante:", error);
    invoice = null;
  }

  if (!invoice || invoice.itens.length === 0) {
    await iniciarFallbackManual(
      from,
      "Não consegui ler os dados automaticamente. Vamos registrar manualmente: qual o valor da despesa? (ex: 150,00)"
    );
    return;
  }

  const obras = await listObrasAtivas();
  if (obras.length === 0) {
    await sendText(
      from,
      "Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra antes de registrar despesas."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  const fornecedor = await findOrCreateFornecedorPorNota(
    invoice.fornecedorNome,
    invoice.fornecedorCnpj
  );

  // Comprovante/recibo de um unico pagamento: reaproveita o fluxo manual de
  // despesa (pergunta obra -> categoria -> etapa -> confirma), garantindo que
  // toda despesa seja sempre classificada, nunca so extraida pela IA.
  if (invoice.itens.length === 1) {
    await iniciarDespesaUnicaExtraida(from, {
      valor: invoice.itens[0].valorTotal,
      descricao: invoice.itens[0].descricao,
      fornecedorId: fornecedor.id,
      fornecedorNome: fornecedor.nome,
    });
    return;
  }

  const dados: Dados = {
    fornecedorId: fornecedor.id,
    fornecedorNome: fornecedor.nome,
    notaItens: invoice.itens,
    notaValorTotal: invoice.valorTotalNota,
  };

  await saveSession(from, ESTADOS.NOTA_AGUARDANDO_OBRA, dados);
  await sendText(
    from,
    `Encontrei ${invoice.itens.length} itens do fornecedor *${fornecedor.nome}*. Em qual obra isso deve ser lançado?`
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
    const fornecedor = await findOrCreateFornecedorPorNota(
      extraido.fornecedorNome,
      null
    );
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
    fornecedorId?: string;
    fornecedorNome?: string;
  }
) {
  const obras = await listObrasAtivas();
  if (obras.length === 0) {
    await sendText(
      from,
      "Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra antes de registrar despesas."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  const dados: Dados = {
    valor: extraido.valor,
    descricao: extraido.descricao,
    fornecedorId: extraido.fornecedorId,
    fornecedorNome: extraido.fornecedorNome,
  };

  await saveSession(from, ESTADOS.DESPESA_OBRA, dados);
  await sendText(
    from,
    `Identifiquei: ${formatBRL(extraido.valor)} — ${extraido.descricao}. Em qual obra isso deve ser lançado?`
  );
  await sendListObras(from);
}

async function iniciarFallbackManual(from: string, mensagem: string) {
  await saveSession(from, ESTADOS.DESPESA_VALOR, {});
  await sendText(from, mensagem);
}

async function handleNotaAguardandoObra(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const obraId = idSemPrefixo(message.replyId, "obra:");
  const obra = obraId ? await findObraById(obraId) : null;
  if (!obra) {
    await sendListObras(from);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    obraId: obra.id,
    obraNome: obra.nome,
  };
  await saveSession(from, ESTADOS.NOTA_AGUARDANDO_ETAPA, dados);
  await sendListEtapas(from, dados.obraId!);
}

async function handleNotaAguardandoEtapa(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const etapaId = idSemPrefixo(message.replyId, "etapa:");
  const etapa = etapaId ? await findEtapaById(etapaId) : null;
  if (!etapa) {
    await sendListEtapas(from, (session.dados_coletados as Dados).obraId!);
    return;
  }

  const dados: Dados = {
    ...session.dados_coletados,
    etapaId: etapa.id,
    etapaNome: etapa.nome,
  };
  await saveSession(from, ESTADOS.NOTA_CONFIRMACAO, dados);
  await enviarConfirmacaoNota(from, dados);
}

async function enviarConfirmacaoNota(from: string, dados: Dados) {
  const itens = dados.notaItens ?? [];
  const linhasItens = itens
    .map((item, i) => `${i + 1}. ${item.descricao} — ${formatBRL(item.valorTotal)}`)
    .join("\n");
  const somaItens = itens.reduce((soma, item) => soma + item.valorTotal, 0);

  const texto =
    `*Confirme os dados da nota:*\n` +
    `🏢 Fornecedor: ${dados.fornecedorNome}\n` +
    `🏗️ Obra: ${dados.obraNome}\n` +
    `📐 Etapa: ${dados.etapaNome}\n\n` +
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
    await sendText(from, "Registro da nota cancelado.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId !== "confirm:sim") {
    await enviarConfirmacaoNota(from, session.dados_coletados as Dados);
    return;
  }

  const dados = session.dados_coletados as Dados;
  const categoriaMaterial = await findCategoriaMaterial();

  if (!categoriaMaterial) {
    await sendText(
      from,
      "Não encontrei a categoria 'Material' cadastrada. Cadastre-a no dashboard e tente novamente."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  for (const item of dados.notaItens ?? []) {
    const material = await findOrCreateMaterial(item.descricao, categoriaMaterial.id);
    await createDespesa({
      obraId: dados.obraId!,
      categoriaId: categoriaMaterial.id,
      etapaId: dados.etapaId!,
      valor: item.valorTotal,
      descricao: `${item.descricao} (${item.quantidade}x)`,
      materialId: material.id,
      fornecedorId: dados.fornecedorId ?? null,
    });
  }

  await sendText(
    from,
    `✅ Nota registrada! ${dados.notaItens?.length ?? 0} itens lançados na obra "${dados.obraNome}".`
  );
  await resetSession(from);
  await sendMenuPrincipal(from);
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
      "Não consegui identificar as etapas nessa planilha. Confira se ela tem um resumo por etapa com os valores totais."
    );
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  const obras = await listObrasAtivas();
  if (obras.length === 0) {
    await sendText(
      from,
      "Você ainda não tem nenhuma obra cadastrada. Cadastre uma obra antes de importar um orçamento."
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
    `Encontrei ${orcamento.etapas.length} etapas nesse orçamento. Para qual obra devo importar?`
  );
  await sendListObras(from);
}

async function handleOrcamentoAguardandoObra(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const obraId = idSemPrefixo(message.replyId, "obra:");
  const obra = obraId ? await findObraById(obraId) : null;
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
    await sendText(from, "Importação do orçamento cancelada.");
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

  await sendText(
    from,
    `✅ Orçamento importado! ${dados.orcamentoEtapas?.length ?? 0} etapas cadastradas na obra "${dados.obraNome}".`
  );
  await resetSession(from);
  await sendMenuPrincipal(from);
}

// ---------- Corrigir Lançamento ----------

async function iniciarCorrecaoLancamento(from: string) {
  const despesas = await listDespesasRecentes(10);

  if (despesas.length === 0) {
    await sendText(from, "Nenhuma despesa registrada ainda.");
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
  const despesaId = idSemPrefixo(message.replyId, "despesa:");
  const despesa = despesaId ? await findDespesaCompletaById(despesaId) : null;
  if (!despesa) {
    await sendListDespesasRecentes(from);
    return;
  }

  const dados: Dados = { despesaId: despesa.id };
  await saveSession(from, ESTADOS.CORRIGIR_SELECIONANDO_CAMPO, dados);
  await sendText(
    from,
    `*Despesa selecionada:*\n` +
      `💰 Valor: ${formatBRL(despesa.valor)}\n` +
      `🏗️ Obra: ${despesa.obraNome}\n` +
      `📁 Categoria: ${despesa.categoriaNome}\n` +
      `📐 Etapa: ${despesa.etapaNome}\n` +
      `🏢 Fornecedor: ${despesa.fornecedorNome ?? "—"}\n` +
      `📝 Descrição: ${despesa.descricao ?? "—"}`
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
      await sendText(from, "Qual o novo valor? (ex: 150,00)");
      return;
    case CAMPO_IDS.DESCRICAO:
      await saveSession(from, ESTADOS.CORRIGIR_DESCRICAO_NOVA, dados);
      await sendText(from, "Digite a nova descrição:");
      return;
    case CAMPO_IDS.CATEGORIA:
      await saveSession(from, ESTADOS.CORRIGIR_CATEGORIA_NOVA, dados);
      await sendListCategorias(from);
      return;
    case CAMPO_IDS.ETAPA: {
      const despesa = await findDespesaCompletaById(dados.despesaId!);
      await saveSession(from, ESTADOS.CORRIGIR_ETAPA_NOVA, dados);
      await sendListEtapas(from, despesa!.obraId);
      return;
    }
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
    await sendText(from, "Digite o novo valor.");
    return;
  }
  const valor = parseValorBR(message.text);
  if (valor === null) {
    await sendText(from, "Não entendi o valor. Digite apenas o número, ex: 150,00");
    return;
  }

  const dados = session.dados_coletados as Dados;
  await updateDespesaCampo(dados.despesaId!, { valor });
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
    await sendText(from, "Digite a nova descrição.");
    return;
  }

  const dados = session.dados_coletados as Dados;
  await updateDespesaCampo(dados.despesaId!, { descricao: message.text });
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
  const categoria = categoriaId ? await findCategoriaById(categoriaId) : null;
  if (!categoria) {
    await sendListCategorias(from);
    return;
  }

  const dados = session.dados_coletados as Dados;
  await updateDespesaCampo(dados.despesaId!, { categoria_id: categoria.id });
  await sendText(from, `✅ Categoria atualizada para "${categoria.nome}".`);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleCorrigirEtapaNova(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const etapaId = idSemPrefixo(message.replyId, "etapa:");
  const etapa = etapaId ? await findEtapaById(etapaId) : null;
  const dados = session.dados_coletados as Dados;

  if (!etapa) {
    const despesa = await findDespesaCompletaById(dados.despesaId!);
    await sendListEtapas(from, despesa!.obraId);
    return;
  }

  await updateDespesaCampo(dados.despesaId!, { etapa_id: etapa.id });
  await sendText(from, `✅ Etapa atualizada para "${etapa.nome}".`);
  await resetSession(from);
  await sendMenuPrincipal(from);
}

async function handleCorrigirFornecedorNovo(
  from: string,
  message: IncomingMessage,
  session: Session
) {
  const fornecedorId = idSemPrefixo(message.replyId, "fornecedor:");
  const fornecedor = fornecedorId ? await findFornecedorById(fornecedorId) : null;
  if (!fornecedor) {
    await sendListFornecedores(from);
    return;
  }

  const dados = session.dados_coletados as Dados;
  await updateDespesaCampo(dados.despesaId!, { fornecedor_id: fornecedor.id });
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
    await sendText(from, "🗑️ Despesa excluída.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId === "confirm:nao") {
    await sendText(from, "Ok, mantido sem alterações.");
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
  await sendButtons(from, "O que você deseja remover?", [
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
    await sendText(from, `Nenhum(a) ${TIPO_REMOVER_LABEL[tipo]} cadastrado(a) ainda.`);
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

  const item = !itemId
    ? null
    : tipo === "obra"
      ? await findObraById(itemId)
      : tipo === "material"
        ? await findMaterialById(itemId)
        : await findFornecedorById(itemId);

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
    `Remover ${TIPO_REMOVER_LABEL[tipo]} "${item.nome}"?\n${aviso}`,
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
    await sendText(from, "Ok, nada foi removido.");
    await resetSession(from);
    await sendMenuPrincipal(from);
    return;
  }

  if (message.replyId !== "confirm:sim") {
    await sendButtons(
      from,
      `Remover ${TIPO_REMOVER_LABEL[dados.tipoRemover!]} "${dados.itemRemoverNome}"?`,
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

    await sendText(
      from,
      `🗑️ ${TIPO_REMOVER_LABEL[dados.tipoRemover!]} "${dados.itemRemoverNome}" removido(a) com sucesso.`
    );
  } catch (error) {
    console.error("Erro ao remover cadastro:", error);
    await sendText(
      from,
      `Não consegui remover "${dados.itemRemoverNome}". Provavelmente existem despesas vinculadas a esse cadastro — corrija ou remova essas despesas primeiro (menu "Corrigir Lançamento").`
    );
  }

  await resetSession(from);
  await sendMenuPrincipal(from);
}
