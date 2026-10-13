import { createAdminClient } from "@/lib/supabase/admin";
import { googleConfigurado, renovarToken } from "./oauth";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const PASTA_RAIZ = "OryonCash";
export const BUCKET_DRIVE = "drive";

let cacheToken: { accessToken: string; expiraEm: number } | null = null;
const cachePastas = new Map<string, string>();

export type Conexao = { email: string | null };

/** Linha unica com o token do dono, ou null se o Drive ainda nao foi conectado. */
async function lerRefreshToken(): Promise<{ refreshToken: string; email: string | null } | null> {
  const { data, error } = await createAdminClient().from("google_conexao").select("refresh_token, email").eq("id", true).maybeSingle();
  if (error || !data) return null;
  return { refreshToken: data.refresh_token, email: data.email };
}

export async function lerConexao(): Promise<Conexao | null> {
  if (!googleConfigurado()) return null;
  const c = await lerRefreshToken();
  return c ? { email: c.email } : null;
}

export async function salvarConexao(refreshToken: string, email: string | null): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("google_conexao")
    .upsert({ id: true, refresh_token: refreshToken, email, conectado_em: new Date().toISOString() });
  if (error) console.error("Erro ao salvar conexao do Google:", error.message);
  cacheToken = null;
  cachePastas.clear();
  return !error;
}

async function tokenDeAcesso(): Promise<string | null> {
  if (cacheToken && cacheToken.expiraEm > Date.now()) return cacheToken.accessToken;
  const c = await lerRefreshToken();
  if (!c) return null;
  const novo = await renovarToken(c.refreshToken);
  if (!novo) return null;
  cacheToken = novo;
  return novo.accessToken;
}

/** O Drive esta conectado e com token valido? (Usado pra decidir onde guardar um arquivo novo.) */
export async function driveDisponivel(): Promise<boolean> {
  if (!googleConfigurado()) return false;
  return (await tokenDeAcesso()) !== null;
}

async function autorizado(init: RequestInit = {}): Promise<RequestInit> {
  const token = await tokenDeAcesso();
  if (!token) throw new Error("Google Drive nao conectado");
  return { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } };
}

/** Erro com o motivo que o Google devolveu (aparece nos logs da Vercel). */
async function erroDoDrive(acao: string, res: Response): Promise<Error> {
  const corpo = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
  return new Error(`Drive: falha ao ${acao} (${res.status}) ${corpo}`);
}

function aspas(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function acharOuCriarPasta(nome: string, paiId: string): Promise<string> {
  const chave = `${paiId}/${nome}`;
  const emCache = cachePastas.get(chave);
  if (emCache) return emCache;

  const q = `name='${aspas(nome)}' and '${paiId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const lista = await fetch(`${API}/files?${new URLSearchParams({ q, fields: "files(id)", pageSize: "1", spaces: "drive" })}`, await autorizado());
  if (!lista.ok) throw await erroDoDrive("listar pastas", lista);
  const achada = ((await lista.json()) as { files?: { id: string }[] }).files?.[0];
  if (achada) {
    cachePastas.set(chave, achada.id);
    return achada.id;
  }
  const cria = await fetch(
    `${API}/files?fields=id`,
    await autorizado({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", parents: [paiId] }),
    })
  );
  if (!cria.ok) throw await erroDoDrive("criar pasta", cria);
  const id = ((await cria.json()) as { id: string }).id;
  cachePastas.set(chave, id);
  return id;
}

/** Cria (se preciso) OryonCash / area / pasta / tipo e devolve o id da ultima. */
export async function garantirCaminho(caminho: string[]): Promise<string> {
  let pai = "root";
  for (const nome of [PASTA_RAIZ, ...caminho.filter(Boolean)]) {
    pai = await acharOuCriarPasta(nome.replace(/[\\/]+/g, "-").trim().slice(0, 100) || "Sem nome", pai);
  }
  return pai;
}

async function iniciarUploadRetomavel(
  e: { nome: string; mimeType: string; tamanho: number; caminho: string[]; origem?: string }
): Promise<string> {
  const paiId = await garantirCaminho(e.caminho);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": e.mimeType || "application/octet-stream",
    "X-Upload-Content-Length": String(e.tamanho),
  };
  // Com Origin, o Google libera o PUT direto do navegador (CORS) na URL da sessao.
  if (e.origem) headers.Origin = e.origem;
  const res = await fetch(
    `${UPLOAD}?uploadType=resumable&fields=id`,
    await autorizado({ method: "POST", headers, body: JSON.stringify({ name: e.nome, parents: [paiId] }) })
  );
  const url = res.headers.get("location");
  if (!res.ok || !url) throw await erroDoDrive("iniciar o envio", res);
  return url;
}

/** Envia um arquivo que ja esta na memoria do servidor. Devolve o id no Drive. */
export async function enviarAoDrive(e: { nome: string; mimeType: string; buffer: Buffer; caminho: string[] }): Promise<string> {
  const url = await iniciarUploadRetomavel({ nome: e.nome, mimeType: e.mimeType, tamanho: e.buffer.length, caminho: e.caminho });
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Length": String(e.buffer.length), "Content-Type": e.mimeType || "application/octet-stream" },
    body: new Uint8Array(e.buffer),
  });
  if (!res.ok) throw await erroDoDrive("enviar", res);
  return ((await res.json()) as { id: string }).id;
}

/** Pro painel: devolve a URL da sessao de envio; o navegador faz o PUT direto no Google. */
export async function prepararEnvioDoNavegador(e: {
  nome: string;
  mimeType: string;
  tamanho: number;
  caminho: string[];
  origem: string;
}): Promise<string> {
  return iniciarUploadRetomavel(e);
}

/** Resposta do Drive com o conteudo do arquivo (pra repassar em stream). */
export async function baixarDoDrive(fileId: string): Promise<Response> {
  const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`, await autorizado());
  if (!res.ok) throw await erroDoDrive("baixar", res);
  return res;
}

export async function moverNoDrive(fileId: string, novoCaminho: string[]): Promise<void> {
  const novoPai = await garantirCaminho(novoCaminho);
  const atual = await fetch(`${API}/files/${encodeURIComponent(fileId)}?fields=parents`, await autorizado());
  if (!atual.ok) throw await erroDoDrive("ler o arquivo", atual);
  const pais = ((await atual.json()) as { parents?: string[] }).parents ?? [];
  if (pais.length === 1 && pais[0] === novoPai) return;
  const params = new URLSearchParams({ addParents: novoPai, fields: "id" });
  if (pais.length) params.set("removeParents", pais.join(","));
  const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}?${params}`, await autorizado({ method: "PATCH" }));
  if (!res.ok) throw await erroDoDrive("mover", res);
}

/** Manda pra lixeira do Drive (recuperavel por 30 dias). */
export async function apagarNoDrive(fileId: string): Promise<void> {
  const res = await fetch(
    `${API}/files/${encodeURIComponent(fileId)}`,
    await autorizado({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) })
  );
  if (!res.ok && res.status !== 404) throw await erroDoDrive("apagar", res);
}
