import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { AREAS, caminhoDoArquivo, ehArea, rotuloDaArea, type AreaArquivo } from "@/lib/arquivos/tipos";
import {
  chaveDaPasta,
  listarPastas,
  listarTipos,
  nomeDaPasta,
  resumoDaArea,
  type ArquivoDePasta,
  type Pasta,
} from "@/lib/arquivos/pastas";
import { abreNoNavegador, formatarArquivadoEm, formatarTamanho } from "@/lib/arquivos/nomes";
import { situacaoDaValidade } from "@/lib/arquivos/validade";
import { buscarArquivos } from "@/lib/arquivos/busca";
import { camposDeEnvioPara } from "@/lib/arquivos/destino";
import { CadastroModal } from "../cadastro-modal";
import { ActionIcon } from "../action-icon";
import { ExcluirArquivoButton } from "./excluir-arquivo-button";
import { FormularioEdicaoArquivo } from "./formulario-edicao-arquivo";
import { NovoArquivoForm } from "./novo-arquivo-form";
import { BadgeValidade } from "./componentes";
import { PastaCard } from "./pasta-card";
import { ListaDeArquivos, type ItemDaLista } from "./lista-de-arquivos";
import { ZonaDeUpload } from "./zona-de-upload";
import { googleConfigurado } from "@/lib/google/oauth";
import { lerConexao } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

type Params = { area?: string; pasta?: string; tipo?: string; q?: string; google?: string };

const AVISO_DO_GOOGLE: Record<string, string> = {
  ok: "Google Drive conectado! Os próximos arquivos já vão para o seu Drive.",
  recusado: "A conexão com o Google foi cancelada. Tente de novo quando quiser.",
  falhou: "Não consegui concluir a conexão com o Google. Tente de novo.",
  "sem-permissao":
    "Faltou marcar a permissão de acesso aos arquivos do Drive na tela do Google. Clique em Conectar de novo e deixe a caixa de arquivos do Drive MARCADA.",
  "sem-chaves": "Faltam as chaves do Google na Vercel (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).",
};

type Linha = {
  id: string;
  area: AreaArquivo;
  obra_id: string | null;
  pasta: string | null;
  tipo: string;
  nome: string;
  descricao: string | null;
  texto_busca: string | null;
  nome_arquivo: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  validade: string | null;
  avisar_dias_antes: number;
  created_at: string;
  obras: { nome: string } | null;
};

function href(p: Params): string {
  const qs = new URLSearchParams();
  if (p.area) qs.set("area", p.area);
  if (p.pasta) qs.set("pasta", p.pasta);
  if (p.tipo) qs.set("tipo", p.tipo);
  if (p.q) qs.set("q", p.q);
  const s = qs.toString();
  return s ? `/dashboard/arquivos?${s}` : "/dashboard/arquivos";
}

function paraPasta(l: Linha): ArquivoDePasta {
  return {
    area: l.area,
    obra_id: l.obra_id,
    obraNome: l.obras?.nome ?? null,
    pasta: l.pasta,
    tipo: l.tipo,
    validade: l.validade,
    avisar_dias_antes: l.avisar_dias_antes,
  };
}

const pastaNomeDe = (l: Linha) => (l.area === "obra" ? (l.obras?.nome ?? l.pasta) : l.pasta);

export default async function ArquivosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const hoje = hojeNoBrasil();

  const [consulta, { data: obrasData }, conexaoGoogle] = await Promise.all([
    supabase.from("arquivos").select("*, obras(nome)").order("created_at", { ascending: false }).limit(2000),
    supabase.from("obras").select("id, nome").is("deleted_at", null).order("nome"),
    lerConexao(),
  ]);

  if (consulta.error) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Arquivos ainda não ativado no Supabase.</p>
        <p className="mt-1">
          Aplique a migration <code>20261014010000_arquivos.sql</code> pra liberar essa tela.
        </p>
      </div>
    );
  }

  const obras = obrasData ?? [];
  const idsDeObras = new Set(obras.map((o) => o.id));
  const todos = (consulta.data ?? []) as unknown as Linha[];
  const area = params.area && ehArea(params.area) ? params.area : null;
  const q = (params.q ?? "").trim();
  const sugestoesDePasta = [...new Set(todos.filter((l) => l.pasta).map((l) => l.pasta as string))];

  // ---- o que mostrar ----
  const migalhas: { rotulo: string; destino: string }[] = [{ rotulo: "Arquivos", destino: href({}) }];
  let pastas: Pasta[] | null = null;
  let gradeDeAreas = false;
  let arquivosDaLista: Linha[] | null = null;
  let mostrarCaminho = false;
  let novo: { area?: AreaArquivo; obraId?: string; pasta?: string; tipo?: string } = {};
  let nomePastaAtual: string | null = null;

  if (q) {
    const buscaveis = todos.map((l) => ({
      id: l.id,
      nome: l.nome,
      tipo: l.tipo,
      area: l.area,
      pastaNome: pastaNomeDe(l),
      descricao: l.descricao,
      textoBusca: l.texto_busca,
      nomeArquivo: l.nome_arquivo,
    }));
    const { exatos, parecidos } = buscarArquivos(buscaveis, q);
    const ordem = [...exatos, ...parecidos].map((b) => b.id);
    arquivosDaLista = ordem.map((id) => todos.find((l) => l.id === id)).filter((l): l is Linha => Boolean(l));
    mostrarCaminho = true;
  } else if (!area) {
    gradeDeAreas = true;
  } else {
    const daArea = todos.filter((l) => l.area === area);
    migalhas.push({ rotulo: rotuloDaArea(area), destino: href({ area }) });
    novo = { area };

    if (!params.pasta) {
      pastas = listarPastas(daArea.map(paraPasta), area, hoje, area === "obra" ? obras : []);
    } else {
      const daPasta = daArea.filter((l) => chaveDaPasta(l) === params.pasta);
      const exemplo = daPasta[0];
      nomePastaAtual = exemplo
        ? nomeDaPasta(params.pasta, { area: exemplo.area, obraNome: exemplo.obras?.nome ?? null })
        : area === "obra"
          ? (obras.find((o) => o.id === params.pasta)?.nome ?? nomeDaPasta(params.pasta))
          : nomeDaPasta(params.pasta);
      migalhas.push({ rotulo: nomePastaAtual, destino: href({ area, pasta: params.pasta }) });
      novo = {
        area,
        ...(area === "obra" && idsDeObras.has(params.pasta) ? { obraId: params.pasta } : { pasta: params.pasta.startsWith("_") ? "" : params.pasta }),
      };

      if (!params.tipo) {
        pastas = listarTipos(daPasta.map(paraPasta), hoje);
      } else {
        migalhas.push({ rotulo: params.tipo, destino: href({ area, pasta: params.pasta, tipo: params.tipo }) });
        novo = { ...novo, tipo: params.tipo };
        arquivosDaLista = daPasta.filter((l) => l.tipo === params.tipo);
      }
    }
  }

  // Prazos: vencidos e vencendo (todas as areas).
  const comPrazo = todos
    .filter((l) => l.validade && ["vencido", "vencendo"].includes(situacaoDaValidade(l.validade, hoje, l.avisar_dias_antes)))
    .sort((a, b) => (a.validade as string).localeCompare(b.validade as string));

  // Pra onde vai um arquivo solto do computador em cima da tela (so quando ha uma pasta aberta).
  const uploadAtivo = Boolean(area) && !q && (area !== "obra" || Boolean(params.pasta));
  const camposDeEnvio = camposDeEnvioPara({ area: area ?? "obra", pastaChave: params.pasta ?? null, tipo: params.tipo ?? null }, idsDeObras);
  const rotuloDoDestino = migalhas.map((m) => m.rotulo).join(" › ") + (params.tipo ? "" : " › Outros");
  const pai = migalhas.length > 1 ? migalhas[migalhas.length - 2] : null;

  const itens: ItemDaLista[] = (arquivosDaLista ?? []).map((l) => ({
    id: l.id,
    nome: l.nome,
    mime_type: l.mime_type,
    nome_arquivo: l.nome_arquivo,
    meta: `Arquivado em ${formatarArquivadoEm(l.created_at)}${formatarTamanho(l.tamanho_bytes) ? ` · ${formatarTamanho(l.tamanho_bytes)}` : ""}`,
    descricao: l.descricao,
    caminho: mostrarCaminho ? caminhoDoArquivo({ area: l.area, pastaNome: pastaNomeDe(l), tipo: l.tipo }) : null,
    validade: l.validade,
    avisar: l.avisar_dias_antes,
    abreNoNavegador: abreNoNavegador(l.mime_type),
  }));

  const acoesPorId: Record<string, React.ReactNode> = {};
  for (const l of arquivosDaLista ?? []) {
    acoesPorId[l.id] = (
      <>
        <a
          href={`/dashboard/arquivos/${l.id}?baixar=1`}
          aria-label="Baixar arquivo"
          title="Baixar arquivo"
          className="inline-flex h-10 items-center justify-center rounded-brand-sm border border-brand-gray-300 bg-white px-3 text-xs font-bold text-brand-black hover:bg-brand-gray-100"
        >
          Baixar
        </a>
        <CadastroModal
          titulo="Editar arquivo"
          descricao="Mude o nome, a pasta, o tipo ou a validade. O WhatsApp passa a achar o arquivo pelo novo endereço."
          botao="Editar"
          icone={<ActionIcon name="edit" />}
          variante="icone"
          modalSize="wide"
        >
          <FormularioEdicaoArquivo
            arquivo={{
              id: l.id,
              nome: l.nome,
              area: l.area,
              obra_id: l.obra_id,
              pasta: l.pasta,
              tipo: l.tipo,
              descricao: l.descricao,
              validade: l.validade,
              avisar_dias_antes: l.avisar_dias_antes,
            }}
            obras={obras}
            sugestoesDePasta={sugestoesDePasta}
          />
        </CadastroModal>
        <ExcluirArquivoButton id={l.id} nome={l.nome} />
      </>
    );
  }

  return (
    <ZonaDeUpload ativo={uploadAtivo} destino={camposDeEnvio} rotuloDoDestino={rotuloDoDestino}>
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-black text-brand-black">Arquivos</h1>
            {pai && (
              <Link href={pai.destino} className="mt-1 inline-block text-xs font-bold text-brand-gray-600 hover:text-brand-red sm:hidden">
                ← Voltar para {pai.rotulo}
              </Link>
            )}
            <nav aria-label="Caminho" className="mt-1 hidden flex-wrap items-center gap-1 text-sm text-brand-gray-500 sm:flex">
              {migalhas.map((m, i) => (
                <span key={m.destino} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden="true">›</span>}
                  {i === migalhas.length - 1 && !q ? (
                    <span className="font-semibold text-brand-black">{m.rotulo}</span>
                  ) : (
                    <Link href={m.destino} className="hover:text-brand-red hover:underline">
                      {m.rotulo}
                    </Link>
                  )}
                </span>
              ))}
              {q && (
                <>
                  <span aria-hidden="true">›</span>
                  <span className="font-semibold text-brand-black">Busca</span>
                </>
              )}
            </nav>
            {migalhas.length > 1 && (
              <p className="mt-1 text-sm font-semibold text-brand-black sm:hidden">{migalhas.slice(1).map((m) => m.rotulo).join(" › ")}</p>
            )}
          </div>
          <CadastroModal
            titulo="Novo arquivo"
            descricao="O arquivo fica guardado e você pede de volta pelo WhatsApp quando precisar."
            botao="+ Novo arquivo"
            variante="primario"
            modalSize="wide"
            triggerClassName="oc-button oc-button-primary w-full sm:w-auto"
          >
            <NovoArquivoForm
              obras={obras}
              areaInicial={novo.area}
              obraIdInicial={novo.obraId}
              pastaInicial={novo.pasta}
              tipoInicial={novo.tipo}
              sugestoesDePasta={sugestoesDePasta}
            />
          </CadastroModal>
        </div>

        {params.google && AVISO_DO_GOOGLE[params.google] && (
          <p
            className={`rounded-card border px-4 py-3 text-sm font-semibold ${
              params.google === "ok" ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-status-warning/30 bg-status-warning/10 text-status-warning"
            }`}
          >
            {AVISO_DO_GOOGLE[params.google]}
          </p>
        )}

        {!googleConfigurado() && (
          <p className="rounded-card border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-brand-gray-700">
            <strong className="text-brand-black">Google Drive ainda não está ativo.</strong> Faltam as variáveis <code>GOOGLE_CLIENT_ID</code> e{" "}
            <code>GOOGLE_CLIENT_SECRET</code> na Vercel (ou falta publicar de novo depois de criá-las). Enquanto isso, os arquivos ficam no armazenamento do Supabase.
          </p>
        )}

        {googleConfigurado() &&
          (conexaoGoogle ? (
            <p className="text-xs text-brand-gray-500">
              ☁️ Google Drive conectado{conexaoGoogle.email ? ` (${conexaoGoogle.email})` : ""}: novos arquivos ficam na pasta <strong>OryonCash</strong> do seu Drive.{" "}
              <a href="/api/google/conectar" className="underline hover:text-brand-red">
                Reconectar
              </a>
            </p>
          ) : (
            <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-brand-gray-700">
                <strong className="text-brand-black">Guarde os arquivos no seu Google Drive.</strong> Sem espaço limitado, em pastas organizadas.
              </p>
              <a href="/api/google/conectar" className="oc-button oc-button-primary text-xs">
                Conectar Google Drive
              </a>
            </div>
          ))}

        <form action="/dashboard/arquivos" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar: matrícula, alvará, certidão..."
            className="min-w-0 flex-1 rounded-brand-sm border border-black/10 bg-white px-3 py-2.5 text-sm font-medium text-brand-black"
          />
          <button type="submit" className="oc-button oc-button-dark text-xs">
            Buscar
          </button>
          {q && (
            <Link href={href({})} className="oc-button oc-button-soft text-xs">
              Limpar
            </Link>
          )}
        </form>

        {gradeDeAreas && (
          <>
            {comPrazo.length > 0 && (
              <section className="rounded-card border border-status-warning/30 bg-status-warning/10 p-4 shadow-card">
                <p className="text-sm font-bold text-brand-black">Atenção aos prazos</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {comPrazo.slice(0, 8).map((l) => (
                    <li key={l.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <a href={`/dashboard/arquivos/${l.id}`} target="_blank" className="break-words font-semibold text-brand-black hover:underline">
                        {l.nome}
                      </a>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-brand-gray-500">
                        {caminhoDoArquivo({ area: l.area, pastaNome: pastaNomeDe(l), tipo: l.tipo })}
                        <BadgeValidade validade={l.validade} avisar={l.avisar_dias_antes} hoje={hoje} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {AREAS.map((a) => {
                const r = resumoDaArea(todos.filter((l) => l.area === a.id).map(paraPasta), hoje);
                return (
                  <PastaCard
                    key={a.id}
                    destino={href({ area: a.id })}
                    nome={a.rotulo}
                    detalhe={a.descricao}
                    total={r.total}
                    vencidos={r.vencidos}
                    vencendo={r.vencendo}
                    grande
                    alvo={{ area: a.id, pastaChave: null }}
                    envio={camposDeEnvioPara({ area: a.id, pastaChave: null }, idsDeObras)}
                  />
                );
              })}
            </div>
            {todos.length === 0 && (
              <p className="rounded-card border border-brand-gray-300/60 bg-white p-5 text-sm text-brand-gray-500 shadow-card">
                Nenhum arquivo ainda. Mande um PDF ou foto pelo WhatsApp com uma legenda (ex: <em>matrícula do lote 12 do Aurora</em>) ou use{" "}
                <strong>+ Novo arquivo</strong>.
              </p>
            )}
          </>
        )}

        {pastas && (
          <>
            {pastas.length === 0 ? (
              <p className="rounded-card border border-brand-gray-300/60 bg-white p-5 text-sm text-brand-gray-500 shadow-card">
                Nada por aqui ainda. Use <strong>+ Novo arquivo</strong>, arraste arquivos do computador para cá, ou mande pelo WhatsApp.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {pastas.map((p) => (
                  <PastaCard
                    key={p.chave}
                    destino={href(params.pasta ? { area: area ?? undefined, pasta: params.pasta, tipo: p.chave } : { area: area ?? undefined, pasta: p.chave })}
                    nome={p.nome}
                    total={p.total}
                    vencidos={p.vencidos}
                    vencendo={p.vencendo}
                    alvo={params.pasta ? { area: area ?? undefined, pastaChave: params.pasta, tipo: p.chave } : { area: area ?? undefined, pastaChave: p.chave }}
                    envio={camposDeEnvioPara(
                      params.pasta ? { area: area ?? "obra", pastaChave: params.pasta, tipo: p.chave } : { area: area ?? "obra", pastaChave: p.chave },
                      idsDeObras
                    )}
                  />
                ))}
              </div>
            )}
            {!params.pasta && area && <p className="hidden text-xs text-brand-gray-500 sm:block">Dica: arraste arquivos de uma lista até uma pasta para movê-los, ou arraste arquivos do computador para uma pasta para guardá-los.</p>}
          </>
        )}

        {arquivosDaLista && (
          <section className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white pb-1 shadow-card">
            <div className="border-b border-brand-gray-300/60 px-4 py-3 sm:px-5">
              <p className="text-sm font-semibold text-brand-black">
                {arquivosDaLista.length} arquivo{arquivosDaLista.length === 1 ? "" : "s"}
                {nomePastaAtual && !mostrarCaminho ? ` em ${nomePastaAtual}` : ""}
              </p>
            </div>
            {arquivosDaLista.length === 0 ? (
              <p className="p-5 text-sm text-brand-gray-500">{q ? "Nenhum arquivo encontrado. Tente outras palavras." : "Nada por aqui."}</p>
            ) : (
              <ListaDeArquivos
                itens={itens}
                acoesPorId={acoesPorId}
                hoje={hoje}
                obras={obras}
                sugestoesDePasta={sugestoesDePasta}
                contexto={{ area: novo.area ?? "obra", obraId: novo.obraId ?? "", pasta: novo.pasta ?? "", tipo: novo.tipo ?? "" }}
              />
            )}
          </section>
        )}

        {/* Espaco pra barra de selecao fixa no celular nao cobrir o fim da lista. */}
        {arquivosDaLista && arquivosDaLista.length > 0 && <div className="h-16 sm:hidden" />}
      </div>
    </ZonaDeUpload>
  );
}
