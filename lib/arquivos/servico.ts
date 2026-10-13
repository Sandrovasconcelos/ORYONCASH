import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/database.types";
import { downloadWhatsAppMedia } from "@/lib/whatsapp/media";
import type { IncomingMedia } from "@/lib/whatsapp/parse";
import { sendButtons, sendDocument, sendList, sendText } from "@/lib/whatsapp/messages";
import { saveSession, resetSession } from "@/lib/whatsapp/session";
import { ESTADOS } from "@/lib/conversation/states";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { candidatosPorPista } from "@/lib/conversation/agruparPorNome";
import { ehTelegram } from "@/lib/telegram/ids";
import { classificarArquivo, type LeituraArquivo } from "@/lib/gemini/classificarArquivo";
import { ehDono } from "@/lib/acesso/dono";
import { buscarArquivos, type ArquivoBuscavel } from "./busca";
import { AJUDA_DE_CORRECAO, lerCorrecao } from "./comandos";
import { legendaPedeGuardar, nomeDoArquivoSugere, pareceBuscaDeArquivo, pareceConsultaDeVencimentos } from "./gate";
import { extensaoDoArquivo, nomeSeguro } from "./nomes";
import { caminhoDoArquivo, normalizarTipo, TIPO_PADRAO, type AreaArquivo } from "./tipos";
import { diasParaVencer, formatarDataBR, situacaoDaValidade, textoDaValidade } from "./validade";

const BUCKET = "comprovantes";
const PREFIXO_STORAGE = "arquivos";
const LINK_VALIDO_SEGUNDOS = 60 * 60 * 24;
const LIMITE_LISTA = 10;

type ArquivoRow = Database["public"]["Tables"]["arquivos"]["Row"];
type ArquivoComObra = ArquivoRow & { obras: { nome: string } | null };

const MIME_PLANILHA = ["spreadsheetml", "ms-excel"];

const ehPlanilha = (mime: string) => MIME_PLANILHA.some((m) => mime.includes(m));
const ehImagemOuPdf = (mime: string) => mime === "application/pdf" || mime.startsWith("image/");

// ---------- leitura de dados ----------

async function carregarObras(): Promise<{ id: string; nome: string }[]> {
  const { data } = await createAdminClient().from("obras").select("id, nome").is("deleted_at", null).order("nome");
  return data ?? [];
}

function pastaDe(a: ArquivoComObra): string | null {
  return a.area === "obra" ? (a.obras?.nome ?? null) : a.pasta;
}

function caminhoDe(a: ArquivoComObra): string {
  return caminhoDoArquivo({ area: a.area, pastaNome: pastaDe(a), tipo: a.tipo });
}

async function buscarPorId(id: string): Promise<ArquivoComObra | null> {
  const { data } = await createAdminClient().from("arquivos").select("*, obras(nome)").eq("id", id).maybeSingle();
  return (data as ArquivoComObra | null) ?? null;
}

// ---------- resumo e botoes ----------

function linhaDeValidade(a: ArquivoRow, hoje: string): string {
  if (!a.validade) return "Validade: sem validade";
  const situacao = situacaoDaValidade(a.validade, hoje, a.avisar_dias_antes);
  const marca = situacao === "vencido" ? "⚠️ " : situacao === "vencendo" ? "⏰ " : "";
  return `Validade: ${marca}${formatarDataBR(a.validade)} (${textoDaValidade(a.validade, hoje)})`;
}

function textoResumo(a: ArquivoComObra, titulo: string): string {
  const hoje = hojeNoBrasil();
  const partes = [`${titulo} *${a.nome}*`, `📂 ${caminhoDe(a)}`, linhaDeValidade(a, hoje)];
  if (a.area === "obra" && !a.obras?.nome) partes.push('❓ Não identifiquei a obra. Toque em *Corrigir* e diga, por exemplo, "obra Aurora".');
  if (a.descricao) partes.push(`📝 ${a.descricao}`);
  return partes.join("\n");
}

async function enviarResumoComBotoes(from: string, a: ArquivoComObra, titulo = "📁 Guardei:") {
  await sendButtons(from, textoResumo(a, titulo), [
    { id: `arq:ok:${a.id}`, title: "✅ Está certo" },
    { id: `arq:mudar:${a.id}`, title: "✏️ Corrigir" },
    { id: `arq:del:${a.id}`, title: "🗑️ Excluir" },
  ]);
}

// ---------- guardar ----------

type EntradaGuardar = {
  mimeType: string;
  legenda?: string | null;
  nomeArquivo?: string | null;
  buffer: Buffer;
  mediaId?: string;
  leitura: LeituraArquivo | null;
  /** Arquivo que ja esta no Storage (ex: veio do fluxo de nota e nao era uma conta). */
  jaNoStorage?: { bucket: string; path: string };
};

function tituloDaLegenda(legenda: string | null | undefined): string | null {
  const t = legenda?.trim().replace(/\s+/g, " ");
  if (!t) return null;
  const sem = t.replace(/^(guarda|guardar|guarde|arquivo|arquivar)[:\s-]*/i, "").trim() || t;
  return (sem.charAt(0).toUpperCase() + sem.slice(1)).slice(0, 80);
}

async function guardar(from: string, e: EntradaGuardar): Promise<void> {
  const supabase = createAdminClient();
  const obras = await carregarObras();
  const leitura = e.leitura;

  let obraId: string | null = null;
  if (leitura?.obraNome) {
    const achadas = candidatosPorPista(obras, leitura.obraNome);
    if (achadas.length === 1) obraId = achadas[0].id;
  }
  const area: AreaArquivo = obraId ? "obra" : (leitura?.area ?? "obra");
  const pasta = area === "obra" ? null : (leitura?.pasta ?? null);
  const nome =
    leitura?.nome ??
    tituloDaLegenda(e.legenda) ??
    (e.nomeArquivo ? e.nomeArquivo.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim() : null) ??
    "Arquivo";
  const validade = leitura?.validade && Number(leitura.validade.slice(0, 4)) >= 2000 ? leitura.validade : null;

  let bucket = BUCKET;
  let path: string;
  if (e.jaNoStorage) {
    bucket = e.jaNoStorage.bucket;
    path = e.jaNoStorage.path;
  } else {
    const ano = hojeNoBrasil().slice(0, 4);
    path = `${PREFIXO_STORAGE}/${ano}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(nome, 40)}.${extensaoDoArquivo(e.mimeType, e.nomeArquivo)}`;
    const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(path, e.buffer, {
      contentType: e.mimeType || "application/octet-stream",
      upsert: false,
    });
    if (erroUpload) {
      console.error("Erro ao subir arquivo:", erroUpload.message);
      await sendText(from, "⚠️ Não consegui guardar o arquivo agora. Tenta de novo em instantes.");
      return;
    }
  }

  const { data, error } = await supabase
    .from("arquivos")
    .insert({
      area,
      obra_id: obraId,
      pasta,
      tipo: normalizarTipo(leitura?.tipo ?? TIPO_PADRAO),
      nome: normalizarNomeTitulo(nome),
      descricao: leitura?.resumo ?? null,
      nome_arquivo: e.nomeArquivo ?? null,
      storage_bucket: bucket,
      storage_path: path,
      mime_type: e.mimeType || null,
      tamanho_bytes: e.buffer.length,
      validade,
      origem: ehTelegram(from) ? "telegram" : "whatsapp",
      enviado_por: from,
    })
    .select("*, obras(nome)")
    .single();

  if (error || !data) {
    console.error("Erro ao registrar arquivo:", error?.message);
    await sendText(from, "⚠️ Guardei o arquivo, mas não consegui registrar. Tenta enviar de novo.");
    return;
  }
  await resetSession(from);
  await enviarResumoComBotoes(from, data as ArquivoComObra);
}

function normalizarNomeTitulo(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").slice(0, 120) || "Arquivo";
}

async function baixarELer(from: string, media: IncomingMedia, forcado: boolean): Promise<void> {
  const obras = (await carregarObras()).map((o) => o.nome);
  let arquivo: { buffer: Buffer; mimeType: string };
  try {
    arquivo = await downloadWhatsAppMedia(media.id, media.mimeType);
  } catch (error) {
    console.error("Erro ao baixar arquivo:", error);
    await sendText(from, "⚠️ Não consegui baixar o arquivo. Manda de novo?");
    return;
  }
  await sendText(from, forcado ? "📁 Recebi o arquivo, organizando..." : "📁 Recebi o documento, organizando...");
  const leitura = await classificarArquivo({
    buffer: arquivo.buffer,
    mimeType: media.mimeType || arquivo.mimeType,
    legenda: media.legenda,
    nomeArquivo: media.nomeArquivo,
    obras,
    hoje: hojeNoBrasil(),
  });
  await guardar(from, {
    mimeType: media.mimeType || arquivo.mimeType,
    legenda: media.legenda,
    nomeArquivo: media.nomeArquivo,
    buffer: arquivo.buffer,
    mediaId: media.id,
    leitura,
  });
}

/**
 * Decide se a midia recebida e um ARQUIVO pra guardar (e nao uma conta).
 * Devolve true quando tratou (guardou ou perguntou). So pro dono.
 *  - formatos que nao sao PDF/imagem/planilha (Word, DWG, video...): sempre arquivo;
 *  - legenda ou nome do arquivo indicam documento: arquivo;
 *  - PDF sem pista nenhuma: a IA le e decide (na duvida, pergunta);
 *  - foto sem legenda: segue o fluxo de contas (e la, se nao for uma conta, oferece guardar).
 */
export async function tentarArquivoRecebido(from: string, media: IncomingMedia): Promise<boolean> {
  try {
    if (!(await ehDono(from))) return false;
    const mime = (media.mimeType ?? "").split(";")[0].trim().toLowerCase();

    if (!ehImagemOuPdf(mime) && !ehPlanilha(mime)) {
      await baixarELer(from, media, true);
      return true;
    }
    if (legendaPedeGuardar(media.legenda)) {
      await baixarELer(from, media, false);
      return true;
    }
    if (ehPlanilha(mime)) return false; // orcamento
    const pista = nomeDoArquivoSugere(media.nomeArquivo);
    if (pista === "conta") return false;
    if (pista === "documento") {
      await baixarELer(from, media, false);
      return true;
    }
    if (mime !== "application/pdf") return false;

    // PDF sem pista: deixa a IA decidir.
    let arquivo: { buffer: Buffer; mimeType: string };
    try {
      arquivo = await downloadWhatsAppMedia(media.id, media.mimeType);
    } catch {
      return false; // o fluxo de contas tenta baixar de novo e avisa se falhar
    }
    const obras = (await carregarObras()).map((o) => o.nome);
    const leitura = await classificarArquivo({
      buffer: arquivo.buffer,
      mimeType: mime,
      legenda: media.legenda,
      nomeArquivo: media.nomeArquivo,
      obras,
      hoje: hojeNoBrasil(),
    });
    if (!leitura || leitura.categoria === "conta") return false;
    if (leitura.categoria === "documento") {
      await sendText(from, "📁 Isso parece um documento pra guardar, organizando...");
      await guardar(from, { mimeType: mime, legenda: media.legenda, nomeArquivo: media.nomeArquivo, buffer: arquivo.buffer, mediaId: media.id, leitura });
      return true;
    }
    await perguntarContaOuArquivo(from, media);
    return true;
  } catch (error) {
    console.error("Erro ao tratar arquivo recebido:", error);
    return false;
  }
}

export async function perguntarContaOuArquivo(from: string, media: IncomingMedia): Promise<void> {
  await saveSession(from, ESTADOS.ARQUIVO_OFERTA, {
    mediaId: media.id,
    mimeType: media.mimeType,
    legenda: media.legenda ?? null,
    nomeArquivo: media.nomeArquivo ?? null,
  });
  await sendButtons(from, "📎 Esse arquivo é uma conta (nota, boleto, comprovante) ou um documento pra guardar?", [
    { id: "arq:conta", title: "💸 É uma conta" },
    { id: "arq:guardar", title: "📁 Guardar arquivo" },
  ]);
}

/** Arquivo que o fluxo de contas leu e viu que nao e uma conta: oferece guardar (ja esta no Storage). */
export async function oferecerGuardarComprovante(
  from: string,
  comprovante: { bucket: string; path: string; mimeType: string; mediaId?: string | null; nomeArquivo?: string | null }
): Promise<boolean> {
  if (!(await ehDono(from))) return false;
  await saveSession(from, ESTADOS.ARQUIVO_OFERTA, {
    // O comprovante inteiro fica guardado: "Lançar à mão" retoma o fluxo de despesa com ele.
    comprovante: comprovante as unknown as Json,
    jaNoStorage: { bucket: comprovante.bucket, path: comprovante.path },
    mimeType: comprovante.mimeType,
    mediaId: comprovante.mediaId ?? null,
    nomeArquivo: comprovante.nomeArquivo ?? null,
  });
  await sendButtons(from, "🤔 Não consegui ler isso como uma conta. É um documento pra guardar no seu arquivo?", [
    { id: "arq:guardar", title: "📁 Guardar arquivo" },
    { id: "arq:manual", title: "✍️ Lançar à mão" },
  ]);
  return true;
}

/** Resposta ao "É uma conta ou documento?" - devolve a midia pra o motor seguir com o fluxo de contas. */
export function midiaDaOferta(dados: Record<string, unknown>): IncomingMedia | null {
  if (typeof dados.mediaId !== "string" || typeof dados.mimeType !== "string") return null;
  return {
    id: dados.mediaId,
    mimeType: dados.mimeType,
    ...(typeof dados.legenda === "string" && dados.legenda ? { legenda: dados.legenda } : {}),
    ...(typeof dados.nomeArquivo === "string" && dados.nomeArquivo ? { nomeArquivo: dados.nomeArquivo } : {}),
  };
}

export async function guardarDaOferta(from: string, dados: Record<string, unknown>): Promise<void> {
  const jaNoStorage = dados.jaNoStorage as { bucket?: string; path?: string } | undefined;
  if (jaNoStorage?.bucket && jaNoStorage.path) {
    const baixado = await createAdminClient().storage.from(jaNoStorage.bucket).download(jaNoStorage.path);
    if (baixado.error || !baixado.data) {
      await sendText(from, "⚠️ Não achei mais o arquivo. Manda de novo?");
      await resetSession(from);
      return;
    }
    const buffer = Buffer.from(await baixado.data.arrayBuffer());
    const mimeType = typeof dados.mimeType === "string" ? dados.mimeType : "application/octet-stream";
    const obras = (await carregarObras()).map((o) => o.nome);
    const leitura = await classificarArquivo({
      buffer,
      mimeType,
      nomeArquivo: typeof dados.nomeArquivo === "string" ? dados.nomeArquivo : null,
      obras,
      hoje: hojeNoBrasil(),
    });
    await guardar(from, {
      mimeType,
      nomeArquivo: typeof dados.nomeArquivo === "string" ? dados.nomeArquivo : null,
      buffer,
      leitura,
      jaNoStorage: { bucket: jaNoStorage.bucket, path: jaNoStorage.path },
    });
    return;
  }
  const media = midiaDaOferta(dados);
  if (!media) {
    await sendText(from, "⚠️ Perdi o arquivo da conversa. Manda de novo?");
    await resetSession(from);
    return;
  }
  await resetSession(from);
  await baixarELer(from, media, false);
}

// ---------- botoes e correcao ----------

async function removerDoStorage(a: ArquivoRow) {
  // So apaga o que a biblioteca criou - arquivos reaproveitados de comprovantes ficam.
  if (a.storage_path.startsWith(`${PREFIXO_STORAGE}/`)) {
    await createAdminClient().storage.from(a.storage_bucket).remove([a.storage_path]);
  }
}

/** Botoes arq:ok / arq:mudar / arq:del / arq:delok / arq:ver. */
export async function tratarBotaoDeArquivo(from: string, replyId: string): Promise<void> {
  const [, acao, id] = replyId.split(":");
  const a = id ? await buscarPorId(id) : null;
  if (!a) {
    await sendText(from, "🤔 Esse arquivo não existe mais.");
    return;
  }
  if (acao === "ok") {
    await resetSession(from);
    await sendText(from, "👍 Pronto. Pra pedir de volta é só dizer, por exemplo: *manda " + a.nome.toLowerCase() + "*.");
    return;
  }
  if (acao === "mudar") {
    await saveSession(from, ESTADOS.ARQUIVO_CORRIGIR, { arquivoId: a.id });
    await sendText(from, AJUDA_DE_CORRECAO);
    return;
  }
  if (acao === "del") {
    await sendButtons(from, `🗑️ Excluir *${a.nome}* de vez?`, [
      { id: `arq:delok:${a.id}`, title: "🗑️ Sim, excluir" },
      { id: `arq:ok:${a.id}`, title: "Manter" },
    ]);
    return;
  }
  if (acao === "delok") {
    await createAdminClient().from("arquivos").delete().eq("id", a.id);
    await removerDoStorage(a);
    await resetSession(from);
    await sendText(from, `🗑️ Excluí *${a.nome}*.`);
    return;
  }
  if (acao === "ver") {
    await enviarArquivo(from, a);
  }
}

/** Texto livre no modo "Corrigir". */
export async function aplicarCorrecao(from: string, texto: string, dados: Record<string, unknown>): Promise<void> {
  const id = typeof dados.arquivoId === "string" ? dados.arquivoId : null;
  const a = id ? await buscarPorId(id) : null;
  if (!a) {
    await resetSession(from);
    await sendText(from, "🤔 Esse arquivo não existe mais.");
    return;
  }
  const correcao = lerCorrecao(texto);
  if (!correcao) {
    await sendText(from, `🤔 Não entendi.\n\n${AJUDA_DE_CORRECAO}\n\nPra sair, digite *menu*.`);
    return;
  }
  const supabase = createAdminClient();
  const mudancas: Database["public"]["Tables"]["arquivos"]["Update"] = { updated_at: new Date().toISOString() };

  switch (correcao.campo) {
    case "excluir":
      await sendButtons(from, `🗑️ Excluir *${a.nome}* de vez?`, [
        { id: `arq:delok:${a.id}`, title: "🗑️ Sim, excluir" },
        { id: `arq:ok:${a.id}`, title: "Manter" },
      ]);
      return;
    case "obra": {
      const obras = await carregarObras();
      const achadas = candidatosPorPista(obras, correcao.valor);
      if (achadas.length === 0) {
        const nomes = obras.slice(0, 8).map((o) => `• ${o.nome}`).join("\n");
        await sendText(from, `🤔 Não achei a obra "${correcao.valor}".${nomes ? `\n\nSuas obras:\n${nomes}` : ""}\n\nTenta de novo, ou digite *menu* pra sair.`);
        return;
      }
      if (achadas.length > 1) {
        await sendText(from, `🤔 Achei mais de uma:\n${achadas.slice(0, 6).map((o) => `• ${o.nome}`).join("\n")}\n\nDigite o nome com mais detalhe.`);
        return;
      }
      mudancas.area = "obra";
      mudancas.obra_id = achadas[0].id;
      mudancas.pasta = null;
      break;
    }
    case "licitacao":
      mudancas.area = "licitacao";
      mudancas.obra_id = null;
      mudancas.pasta = correcao.valor.slice(0, 80);
      break;
    case "empresa":
    case "pessoal":
      mudancas.area = correcao.campo;
      mudancas.obra_id = null;
      mudancas.pasta = correcao.valor?.slice(0, 80) ?? null;
      break;
    case "tipo":
      mudancas.tipo = normalizarTipo(correcao.valor);
      break;
    case "nome":
      mudancas.nome = normalizarNomeTitulo(correcao.valor);
      break;
    case "validade":
      mudancas.validade = correcao.valor;
      mudancas.aviso_antecipado_em = null;
      mudancas.aviso_vencimento_em = null;
      break;
  }

  const { error } = await supabase.from("arquivos").update(mudancas).eq("id", a.id);
  if (error) {
    console.error("Erro ao corrigir arquivo:", error.message);
    await sendText(from, "⚠️ Não consegui salvar a correção. Tenta de novo.");
    return;
  }
  const atualizado = await buscarPorId(a.id);
  await resetSession(from);
  if (atualizado) await enviarResumoComBotoes(from, atualizado, "✏️ Atualizei:");
}

// ---------- pedir de volta ----------

function nomeDoDownload(a: ArquivoRow): string {
  return `${nomeSeguro(a.nome)}.${extensaoDoArquivo(a.mime_type, a.nome_arquivo)}`;
}

export async function enviarArquivo(from: string, a: ArquivoComObra): Promise<void> {
  const { data, error } = await createAdminClient().storage.from(a.storage_bucket).createSignedUrl(a.storage_path, LINK_VALIDO_SEGUNDOS);
  if (error || !data?.signedUrl) {
    console.error("Erro ao gerar link do arquivo:", error?.message);
    await sendText(from, "⚠️ Não consegui abrir esse arquivo agora. Tenta de novo em instantes.");
    return;
  }
  const hoje = hojeNoBrasil();
  const legenda = [`*${a.nome}*`, caminhoDe(a), a.validade ? linhaDeValidade(a, hoje) : null].filter(Boolean).join("\n");
  try {
    await sendDocument(from, data.signedUrl, nomeDoDownload(a), legenda);
  } catch (e) {
    console.error("Erro ao enviar documento:", e);
    await sendText(from, `⚠️ Não consegui mandar o arquivo por aqui. Abra no painel (Arquivos): *${a.nome}*.`);
  }
}

async function carregarTodos(): Promise<ArquivoComObra[]> {
  const { data } = await createAdminClient().from("arquivos").select("*, obras(nome)").order("created_at", { ascending: false }).limit(1000);
  return (data as ArquivoComObra[] | null) ?? [];
}

function paraBuscavel(a: ArquivoComObra): ArquivoBuscavel {
  return { id: a.id, nome: a.nome, tipo: a.tipo, area: a.area, pastaNome: pastaDe(a), descricao: a.descricao, nomeArquivo: a.nome_arquivo };
}

async function enviarEscolha(from: string, titulo: string, itens: ArquivoComObra[]) {
  const recorte = itens.slice(0, LIMITE_LISTA);
  await sendList(from, {
    bodyText: titulo,
    buttonText: "Escolher arquivo",
    sections: [
      {
        rows: recorte.map((a) => ({
          id: `arq:ver:${a.id}`,
          title: a.nome,
          description: caminhoDe(a),
        })),
      },
    ],
  });
}

async function responderBusca(from: string, pedido: string) {
  const todos = await carregarTodos();
  if (todos.length === 0) {
    await sendText(from, "📂 Você ainda não guardou nenhum arquivo. Me manda um PDF ou foto com uma legenda, por exemplo: *matrícula do lote 12 do Aurora*.");
    return;
  }
  const porId = new Map(todos.map((a) => [a.id, a]));
  const { exatos, parecidos } = buscarArquivos(todos.map(paraBuscavel), pedido);
  const pegar = (lista: ArquivoBuscavel[]) => lista.map((b) => porId.get(b.id)).filter((x): x is ArquivoComObra => Boolean(x));

  if (exatos.length === 1) {
    await enviarArquivo(from, pegar(exatos)[0]);
    return;
  }
  if (exatos.length > 1) {
    await enviarEscolha(from, `📂 Achei ${exatos.length} arquivos. Qual você quer?`, pegar(exatos));
    return;
  }
  if (parecidos.length > 0) {
    await enviarEscolha(from, "🤔 Não achei exatamente isso, mas tem estes parecidos:", pegar(parecidos));
    return;
  }
  await sendText(from, "🤔 Não achei nenhum arquivo com isso. Veja tudo em *Arquivos* no painel, ou me diga de outro jeito (ex: o tipo e a obra).");
}

async function responderVencimentos(from: string) {
  const hoje = hojeNoBrasil();
  const todos = (await carregarTodos())
    .filter((a) => a.validade && diasParaVencer(a.validade, hoje) <= 60)
    .sort((x, y) => (x.validade as string).localeCompare(y.validade as string));
  if (todos.length === 0) {
    await sendText(from, "✅ Nenhum documento vencido ou vencendo nos próximos 60 dias.");
    return;
  }
  const linhas = todos.slice(0, 15).map((a) => {
    const vencido = diasParaVencer(a.validade as string, hoje) < 0;
    return `${vencido ? "⚠️" : "⏰"} *${a.nome}* — ${textoDaValidade(a.validade as string, hoje)}\n   ${caminhoDe(a)}`;
  });
  await sendText(from, `📅 Documentos com prazo:\n\n${linhas.join("\n\n")}`);
}

/** Pedido de arquivo ("manda a matricula do lote 12") ou de vencimentos, por texto ou voz. So pro dono, no menu. */
export async function tentarPedidoDeArquivo(from: string, texto: string | null): Promise<boolean> {
  const t = texto?.trim();
  if (!t) return false;
  const pedeVencimentos = pareceConsultaDeVencimentos(t);
  if (!pedeVencimentos && !pareceBuscaDeArquivo(t)) return false;
  try {
    if (!(await ehDono(from))) return false;
    if (pedeVencimentos) await responderVencimentos(from);
    else await responderBusca(from, t);
    return true;
  } catch (error) {
    console.error("Erro no pedido de arquivo:", error);
    return false;
  }
}

