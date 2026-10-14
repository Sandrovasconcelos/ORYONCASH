import { PASTA_GERAL, PASTA_SEM_OBRA } from "./pastas";
import { ehArea, normalizarTipo, type AreaArquivo } from "./tipos";

/** Onde o arquivo mora (os 4 campos que formam o caminho). */
export type LocalDoArquivo = { area: AreaArquivo; obra_id: string | null; pasta: string | null; tipo: string };

/**
 * Pra onde mover/copiar. So o que vier preenchido muda; o resto fica como esta.
 *  - area: a area de destino;
 *  - pastaChave: a pasta de destino - id de uma obra, nome de um projeto/licitacao,
 *    ou null pra "sem pasta"; undefined = nao mexe na pasta;
 *  - tipo: o tipo (subpasta) de destino.
 */
export type DestinoParcial = { area?: string; pastaChave?: string | null; tipo?: string | null };

/** Aplica um destino (parcial) ao local atual do arquivo e devolve o novo local. */
export function aplicarDestino(atual: LocalDoArquivo, destino: DestinoParcial, idsDeObras: Set<string>): LocalDoArquivo {
  const area: AreaArquivo = destino.area && ehArea(destino.area) ? destino.area : atual.area;
  let obraId = atual.obra_id;
  let pasta = atual.pasta;

  if (destino.pastaChave !== undefined) {
    const chave = destino.pastaChave?.trim() || null;
    if (chave === null || chave === PASTA_SEM_OBRA || chave === PASTA_GERAL) {
      obraId = null;
      pasta = null;
    } else if (area === "obra" && idsDeObras.has(chave)) {
      obraId = chave;
      pasta = null;
    } else {
      obraId = null;
      pasta = chave.slice(0, 80);
    }
  } else if (area !== atual.area) {
    // Mudou de area sem dizer a pasta: a pasta antiga nao faz sentido na area nova.
    obraId = null;
    pasta = null;
  }
  if (area !== "obra") obraId = null;

  const tipo = destino.tipo?.trim() ? normalizarTipo(destino.tipo) : atual.tipo;
  return { area, obra_id: obraId, pasta, tipo };
}

/** O arquivo ja esta nesse local? (Mover pra onde ja esta nao faz nada; copiar pra la ganha " (cópia)" no nome.) */
export function mesmoLocal(a: LocalDoArquivo, b: LocalDoArquivo): boolean {
  return a.area === b.area && a.obra_id === b.obra_id && (a.pasta ?? null) === (b.pasta ?? null) && a.tipo === b.tipo;
}

/**
 * Le o destino dos campos do formulario "Mover para...": area, obra (id, ""
 * = sem obra, "__projeto" = projeto digitado), pasta e tipo.
 */
export function destinoDoFormulario(campos: { area: string; obra_id: string; pasta: string; tipo: string }): DestinoParcial {
  const area = ehArea(campos.area) ? campos.area : undefined;
  const pasta = campos.pasta.trim();
  let pastaChave: string | null;
  if (area === "obra" || area === undefined) {
    pastaChave = campos.obra_id && campos.obra_id !== "__projeto" ? campos.obra_id : campos.obra_id === "__projeto" ? pasta || null : null;
  } else {
    pastaChave = pasta || null;
  }
  return { area, pastaChave, tipo: campos.tipo.trim() || undefined };
}

/** Nome da copia: se vai pro mesmo lugar, vira "Nome (cópia)". */
export function nomeDaCopia(nome: string, noMesmoLocal: boolean): string {
  if (!noMesmoLocal) return nome;
  return `${nome.replace(/ \(cópia( \d+)?\)$/, "")} (cópia)`.slice(0, 120);
}

/** Campos que o envio de arquivo usa pra decidir a pasta (mesmo formato do formulario "Novo arquivo"). */
export type CamposDeEnvio = { area: string; obraId: string; pasta: string; tipo: string };

/**
 * Campos de envio pra uma pasta da tela: a chave e o id de uma obra, o nome de
 * um projeto/licitacao, ou "_sem"/"_geral"/vazio (sem pasta).
 */
export function camposDeEnvioPara(destino: { area: string; pastaChave?: string | null; tipo?: string | null }, idsDeObras: Set<string>): CamposDeEnvio {
  const area = ehArea(destino.area) ? destino.area : "obra";
  const chave = destino.pastaChave?.trim() || "";
  const texto = chave && !chave.startsWith("_") ? chave : "";
  const ehObra = area === "obra" && idsDeObras.has(chave);
  return {
    area,
    obraId: area === "obra" ? (ehObra ? chave : texto ? "__projeto" : "") : "",
    pasta: ehObra ? "" : texto,
    tipo: destino.tipo?.trim() || "Outros",
  };
}
