import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeNoBrasil } from "@/lib/conversation/queries";
import { formatDataBrasil } from "@/lib/format-date";
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
import { abreNoNavegador, formatarTamanho } from "@/lib/arquivos/nomes";
import { formatarDataBR, situacaoDaValidade, textoDaValidade } from "@/lib/arquivos/validade";
import { buscarArquivos } from "@/lib/arquivos/busca";
import { CadastroModal } from "../cadastro-modal";
import { ActionIcon } from "../action-icon";
import { ExcluirArquivoButton } from "./excluir-arquivo-button";
import { FormularioEdicaoArquivo } from "./formulario-edicao-arquivo";
import { NovoArquivoForm } from "./novo-arquivo-form";
import { googleConfigurado } from "@/lib/google/oauth";
import { lerConexao } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

type Params = { area?: string; pasta?: string; tipo?: string; q?: string; google?: string };

const AVISO_DO_GOOGLE: Record<string, string> = {
  ok: "Google Drive conectado! Os próximos arquivos já vão para o seu Drive.",
  recusado: "A conexão com o Google foi cancelada. Tente de novo quando quiser.",
  falhou: "Não consegui concluir a conexão com o Google. Tente de novo.",
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
      pastaNome: l.area === "obra" ? (l.obras?.nome ?? l.pasta) : l.pasta,
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
      nomePastaAtual =
        exemplo
          ? nomeDaPasta(params.pasta, { area: exemplo.area, obraNome: exemplo.obras?.nome ?? null })
          : area === "obra"
            ? (obras.find((o) => o.id === params.pasta)?.nome ?? nomeDaPasta(params.pasta))
            : nomeDaPasta(params.pasta);
      migalhas.push({ rotulo: nomePastaAtual, destino: href({ area, pasta: params.pasta }) });
      novo = {
        area,
        ...(area === "obra" && obras.some((o) => o.id === params.pasta)
          ? { obraId: params.pasta }
          : { pasta: params.pasta.startsWith("_") ? "" : params.pasta }),
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-brand-black">Arquivos</h1>
          <nav aria-label="Caminho" className="mt-1 flex flex-wrap items-center gap-1 text-sm text-brand-gray-500">
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
        </div>
        <CadastroModal
          titulo="Novo arquivo"
          descricao="O arquivo fica guardado e você pede de volta pelo WhatsApp quando precisar."
          botao="+ Novo arquivo"
          variante="primario"
          modalSize="wide"
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

      {googleConfigurado() &&
        (conexaoGoogle ? (
          <p className="text-xs text-brand-gray-500">
            ☁️ Google Drive conectado{conexaoGoogle.email ? ` (${conexaoGoogle.email})` : ""}: novos arquivos ficam na pasta <strong>OryonCash</strong> do seu Drive.{" "}
            <a href="/api/google/conectar" className="underline hover:text-brand-red">
              Reconectar
            </a>
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card">
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
          placeholder="Buscar: matrícula do lote 12, alvará, certidão FGTS..."
          className="min-w-0 flex-1 rounded-brand-sm border border-black/10 bg-white px-3 py-2 text-sm font-medium text-brand-black"
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
              <ul className="mt-2 flex flex-col gap-1.5">
                {comPrazo.slice(0, 8).map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <a href={`/dashboard/arquivos/${l.id}`} target="_blank" className="font-semibold text-brand-black hover:underline">
                      {l.nome}
                    </a>
                    <span className="flex items-center gap-2 text-xs text-brand-gray-500">
                      {caminhoDoArquivo({ area: l.area, pastaNome: l.area === "obra" ? (l.obras?.nome ?? l.pasta) : l.pasta, tipo: l.tipo })}
                      <BadgeValidade validade={l.validade} avisar={l.avisar_dias_antes} hoje={hoje} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AREAS.map((a) => {
              const r = resumoDaArea(todos.filter((l) => l.area === a.id).map(paraPasta), hoje);
              return (
                <PastaCard key={a.id} destino={href({ area: a.id })} nome={a.rotulo} detalhe={a.descricao} total={r.total} vencidos={r.vencidos} vencendo={r.vencendo} grande />
              );
            })}
          </div>
          {todos.length === 0 && (
            <p className="rounded-card border border-brand-gray-300/60 bg-white p-5 text-sm text-brand-gray-500 shadow-card">
              Nenhum arquivo ainda. Mande um PDF ou foto pelo WhatsApp com uma legenda (ex: <em>matrícula do lote 12 do Aurora</em>) ou
              use <strong>+ Novo arquivo</strong>.
            </p>
          )}
        </>
      )}

      {pastas && (
        <>
          {pastas.length === 0 ? (
            <p className="rounded-card border border-brand-gray-300/60 bg-white p-5 text-sm text-brand-gray-500 shadow-card">
              Nada por aqui ainda. Use <strong>+ Novo arquivo</strong> ou mande pelo WhatsApp.
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
                />
              ))}
            </div>
          )}
        </>
      )}

      {arquivosDaLista && (
        <section className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
          <div className="border-b border-brand-gray-300/60 px-5 py-3">
            <p className="text-sm font-semibold text-brand-black">
              {arquivosDaLista.length} arquivo{arquivosDaLista.length === 1 ? "" : "s"}
              {nomePastaAtual && !mostrarCaminho ? ` em ${nomePastaAtual}` : ""}
            </p>
          </div>
          {arquivosDaLista.length === 0 ? (
            <p className="p-5 text-sm text-brand-gray-500">{q ? "Nenhum arquivo encontrado. Tente outras palavras." : "Nada por aqui."}</p>
          ) : (
            <ul className="divide-y divide-brand-gray-300/60">
              {arquivosDaLista.map((l) => (
                <LinhaDeArquivo
                  key={l.id}
                  l={l}
                  hoje={hoje}
                  mostrarCaminho={mostrarCaminho}
                  obras={obras}
                  sugestoesDePasta={sugestoesDePasta}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function PastaCard({
  destino,
  nome,
  detalhe,
  total,
  vencidos,
  vencendo,
  grande = false,
}: {
  destino: string;
  nome: string;
  detalhe?: string;
  total: number;
  vencidos: number;
  vencendo: number;
  grande?: boolean;
}) {
  return (
    <Link
      href={destino}
      className="group flex flex-col gap-2 rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card transition hover:border-brand-red/40 hover:shadow-brand-md"
    >
      <div className="flex items-start justify-between gap-2">
        <IconePasta cheia={total > 0} grande={grande} />
        {(vencidos > 0 || vencendo > 0) && (
          <span
            className={`rounded-brand-sm px-2 py-0.5 text-[11px] font-bold ${
              vencidos > 0 ? "bg-status-danger/10 text-status-danger" : "bg-status-warning/10 text-status-warning"
            }`}
            title={`${vencidos} vencido(s), ${vencendo} vencendo`}
          >
            {vencidos > 0 ? `${vencidos} vencido${vencidos > 1 ? "s" : ""}` : `${vencendo} vencendo`}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-brand-black group-hover:text-brand-red">{nome}</p>
        {detalhe && <p className="mt-0.5 text-xs text-brand-gray-500">{detalhe}</p>}
        <p className="mt-0.5 text-xs text-brand-gray-500">
          {total === 0 ? "Vazia" : `${total} arquivo${total === 1 ? "" : "s"}`}
        </p>
      </div>
    </Link>
  );
}

function IconePasta({ cheia, grande }: { cheia: boolean; grande: boolean }) {
  const tamanho = grande ? 44 : 36;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M4 12a4 4 0 0 1 4-4h10l4 5h18a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V12Z"
        fill={cheia ? "#f6c453" : "#e4e4e7"}
        stroke={cheia ? "#c9962a" : "#a1a1aa"}
        strokeWidth="1.5"
      />
      <path d="M4 18h40v1H4z" fill="#ffffff" opacity="0.45" />
    </svg>
  );
}

function BadgeValidade({ validade, avisar, hoje }: { validade: string | null; avisar: number; hoje: string }) {
  if (!validade) return <span className="rounded-brand-sm bg-brand-gray-100 px-2 py-0.5 text-[11px] font-semibold text-brand-gray-500">sem validade</span>;
  const situacao = situacaoDaValidade(validade, hoje, avisar);
  const cor =
    situacao === "vencido"
      ? "bg-status-danger/10 text-status-danger"
      : situacao === "vencendo"
        ? "bg-status-warning/10 text-status-warning"
        : "bg-brand-gray-100 text-brand-gray-700";
  return (
    <span className={`whitespace-nowrap rounded-brand-sm px-2 py-0.5 text-[11px] font-bold ${cor}`} title={`Validade ${formatarDataBR(validade)}`}>
      {situacao === "ok" ? `vence ${formatarDataBR(validade)}` : textoDaValidade(validade, hoje)}
    </span>
  );
}

function rotuloDoFormato(mime: string | null, nomeArquivo: string | null): string {
  const m = (mime ?? "").toLowerCase();
  const ext = nomeArquivo?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (m === "application/pdf" || ext === "pdf") return "PDF";
  if (m.startsWith("image/")) return "IMG";
  if (m.startsWith("video/")) return "VÍD";
  if (ext === "dwg" || ext === "dxf") return "DWG";
  if (m.includes("word") || ext === "doc" || ext === "docx") return "DOC";
  if (m.includes("sheet") || m.includes("excel") || ext === "xls" || ext === "xlsx") return "XLS";
  if (ext === "zip") return "ZIP";
  return (ext ?? "ARQ").toUpperCase().slice(0, 4);
}

function LinhaDeArquivo({
  l,
  hoje,
  mostrarCaminho,
  obras,
  sugestoesDePasta,
}: {
  l: Linha;
  hoje: string;
  mostrarCaminho: boolean;
  obras: { id: string; nome: string }[];
  sugestoesDePasta: string[];
}) {
  const caminho = caminhoDoArquivo({ area: l.area, pastaNome: l.area === "obra" ? (l.obras?.nome ?? l.pasta) : l.pasta, tipo: l.tipo });
  const tamanho = formatarTamanho(l.tamanho_bytes);
  const abre = abreNoNavegador(l.mime_type);

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-sm bg-brand-gray-100 text-[11px] font-black text-brand-gray-700">
        {rotuloDoFormato(l.mime_type, l.nome_arquivo)}
      </div>
      <div className="min-w-0 flex-1 basis-56">
        <a
          href={`/dashboard/arquivos/${l.id}${abre ? "" : "?baixar=1"}`}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-bold text-brand-black hover:text-brand-red hover:underline"
        >
          {l.nome}
        </a>
        <p className="truncate text-xs text-brand-gray-500">
          {mostrarCaminho ? `${caminho} · ` : ""}
          {formatDataBrasil(l.created_at)}
          {tamanho ? ` · ${tamanho}` : ""}
          {l.descricao ? ` · ${l.descricao}` : ""}
        </p>
      </div>
      <BadgeValidade validade={l.validade} avisar={l.avisar_dias_antes} hoje={hoje} />
      <div className="flex items-center gap-2">
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
      </div>
    </li>
  );
}
