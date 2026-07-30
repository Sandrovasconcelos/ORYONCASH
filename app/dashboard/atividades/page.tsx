import { createAdminClient } from "@/lib/supabase/admin";
import { formatDataHoraBrasil } from "@/lib/format-date";
import { ActionIcon, type ActionIconName } from "../action-icon";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  criacao: "Criação",
  edicao: "Edição",
  exclusao: "Exclusão",
};

const ENTIDADE_LABEL: Record<string, string> = {
  despesa: "Despesa",
  obra: "Obra",
  categoria: "Categoria",
  material: "Material",
  fornecedor: "Fornecedor",
  orcamento: "Orçamento",
  usuario_whatsapp: "Número autorizado",
};

const ORIGEM_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  dashboard: "Dashboard",
};

function getAtividadeIcone(entidade: string, resumo: string): ActionIconName {
  const resumoLower = resumo.toLowerCase();

  if (resumoLower.includes("comprovante")) return "payment";
  if (resumoLower.includes("lixeira") || resumoLower.includes("exclu")) return "trash";
  if (entidade === "despesa") return "receipt";
  if (entidade === "obra") return "building";
  if (entidade === "categoria") return "tag";
  if (entidade === "material") return "box";
  if (entidade === "fornecedor") return "truck";
  if (entidade === "orcamento") return "calculator";
  if (entidade === "usuario_whatsapp") return "phone";

  return "clock";
}

function getAtividadeIconeClasse(tipo: string, entidade: string, resumo: string) {
  const resumoLower = resumo.toLowerCase();

  if (resumoLower.includes("comprovante")) {
    return "bg-status-success/15 text-status-success";
  }
  if (tipo === "exclusao" || resumoLower.includes("lixeira")) {
    return "bg-brand-red/10 text-brand-red";
  }
  if (tipo === "edicao") {
    return "bg-status-warning/15 text-status-warning";
  }
  if (entidade === "usuario_whatsapp") {
    return "bg-status-info/15 text-status-info";
  }

  return "bg-brand-red/10 text-brand-red";
}

type EntidadeFiltro =
  | "despesa"
  | "obra"
  | "categoria"
  | "material"
  | "fornecedor"
  | "orcamento"
  | "usuario_whatsapp";

type DespesaRecente = {
  id: string;
  valor: number;
  descricao: string | null;
  origem: string | null;
  created_at: string;
  categorias: { nome: string } | { nome: string }[] | null;
  obras: { nome: string } | { nome: string }[] | null;
};

function formatDataHora(iso: string): string {
  return formatDataHoraBrasil(iso);
}

function getNomeRelacao(relacao: DespesaRecente["categorias"]): string | null {
  if (!relacao) return null;
  if (Array.isArray(relacao)) return relacao[0]?.nome ?? null;
  return relacao.nome;
}

function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

function variantesTelefone(telefone: string): string[] {
  const numero = normalizarTelefone(telefone);
  const variantes = new Set([numero]);

  if (numero.startsWith("55")) {
    const ddd = numero.slice(2, 4);
    const resto = numero.slice(4);
    if (numero.length === 13 && resto.startsWith("9")) {
      variantes.add(`55${ddd}${resto.slice(1)}`);
    } else if (numero.length === 12) {
      variantes.add(`55${ddd}9${resto}`);
    }
  }

  return Array.from(variantes).filter(Boolean);
}

function resolverAutor(
  autorNome: string | null,
  autorTelefone: string | null,
  nomesPorTelefone: Map<string, string>
) {
  const candidatos = [
    ...(autorTelefone ? variantesTelefone(autorTelefone) : []),
    ...(autorNome ? variantesTelefone(autorNome) : []),
  ];
  return candidatos.map((telefone) => nomesPorTelefone.get(telefone)).find(Boolean) ?? autorNome;
}

function resumoComAutorResolvido(resumo: string, autorResolvido: string | null) {
  if (!autorResolvido) return resumo;
  return resumo.replace(/por\s+55\d{10,11}\b/g, `por ${autorResolvido}`);
}

function HistoricoInicial({ despesas }: { despesas: DespesaRecente[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {despesas.map((d) => (
        <li
          key={d.id}
          className="flex items-start gap-3 rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-brand-sm bg-brand-red/10 text-brand-red">
            <ActionIcon name="receipt" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-brand-black">
                Lançamento de{" "}
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(d.valor)}{" "}
                em {getNomeRelacao(d.obras) ?? "obra"}
              </span>
              <span className="shrink-0 text-xs text-brand-gray-500">
                {formatDataHora(d.created_at)}
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-gray-500">
              Despesa · {getNomeRelacao(d.categorias) ?? "Categoria"} ·{" "}
              {d.origem ?? "sistema"}
              {d.descricao ? ` · ${d.descricao}` : ""}
            </p>
          </div>
        </li>
      ))}

      {despesas.length === 0 && (
        <li className="rounded-card border border-brand-gray-300/60 bg-white p-8 text-center text-sm text-brand-gray-500">
          Nenhuma atividade registrada ainda.
        </li>
      )}
    </ul>
  );
}

export default async function AtividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; entidade?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("atividades")
    .select("id, tipo, entidade, origem, autor_telefone, autor_nome, resumo, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (params.tipo) {
    query = query.eq("tipo", params.tipo as "criacao" | "edicao" | "exclusao");
  }
  if (params.entidade) {
    query = query.eq("entidade", params.entidade as EntidadeFiltro);
  }

  const { data: atividades, error } = await query;
  const telefonesAutor = Array.from(
    new Set(
      (atividades ?? [])
        .flatMap((a) => [
          ...(a.autor_telefone ? variantesTelefone(a.autor_telefone) : []),
          ...(a.autor_nome ? variantesTelefone(a.autor_nome) : []),
        ])
        .filter(Boolean)
    )
  );
  const { data: usuariosWhatsapp } =
    telefonesAutor.length > 0
      ? await supabase
          .from("usuarios_whatsapp")
          .select("telefone, nome")
          .in("telefone", telefonesAutor)
      : { data: [] };
  const nomesPorTelefone = new Map(
    (usuariosWhatsapp ?? []).map((usuario) => [normalizarTelefone(usuario.telefone), usuario.nome])
  );
  const deveExibirHistoricoInicial = Boolean(error) || (atividades ?? []).length === 0;
  const { data: despesasRecentes } = deveExibirHistoricoInicial
    ? await supabase
        .from("despesas")
        .select("id, valor, descricao, origem, created_at, categorias(nome), obras(nome)")
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<DespesaRecente[]>()
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
        <p className="text-lg font-semibold text-brand-black">Histórico operacional</p>
        <p className="mt-1 text-sm text-brand-gray-500">
          Tudo que foi lançado, editado e apagado pelo WhatsApp e pelo dashboard.
        </p>
      </div>

      {error && (
        <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700">
          <p className="font-semibold text-brand-black">Auditoria em modo temporário.</p>
          <p className="mt-1">
            A tabela <code>atividades</code> ainda não existe no Supabase. Enquanto a
            migration não for aplicada, estou exibindo os lançamentos recentes como
            histórico operacional.
          </p>
        </div>
      )}

      {!error && (atividades ?? []).length === 0 && (despesasRecentes ?? []).length > 0 && (
        <div className="rounded-card border border-brand-gray-300/70 bg-white p-5 text-sm text-brand-gray-600 shadow-card">
          <p className="font-semibold text-brand-black">Histórico inicial recuperado.</p>
          <p className="mt-1">
            A auditoria real foi criada agora e ainda não possui registros próprios.
            Enquanto novas edições e cadastros começam a ser auditados, estou exibindo os
            lançamentos recentes que já existiam no sistema.
          </p>
        </div>
      )}

      {deveExibirHistoricoInicial ? (
        <HistoricoInicial despesas={despesasRecentes ?? []} />
      ) : (
        <>
          <form className="flex flex-wrap items-center gap-2">
            <select
              name="tipo"
              defaultValue={params.tipo ?? ""}
              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
            >
              <option value="">Todos os tipos</option>
              <option value="criacao">Criação</option>
              <option value="edicao">Edição</option>
              <option value="exclusao">Exclusão</option>
            </select>
            <select
              name="entidade"
              defaultValue={params.entidade ?? ""}
              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
            >
              <option value="">Todas as entidades</option>
              <option value="despesa">Despesa</option>
              <option value="obra">Obra</option>
              <option value="categoria">Categoria</option>
              <option value="material">Material</option>
              <option value="fornecedor">Fornecedor</option>
              <option value="orcamento">Orçamento</option>
              <option value="usuario_whatsapp">Número autorizado</option>
            </select>
            <button
              type="submit"
              className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700"
            >
              Filtrar
            </button>
          </form>

          <ul className="flex flex-col gap-2">
            {(atividades ?? []).map((a) => {
              const autorResolvido = resolverAutor(
                a.autor_nome,
                a.autor_telefone,
                nomesPorTelefone
              );
              const icone = getAtividadeIcone(a.entidade, a.resumo);
              const iconeClasse = getAtividadeIconeClasse(a.tipo, a.entidade, a.resumo);

              return (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-brand-sm ${iconeClasse}`}
                  >
                    <ActionIcon name={icone} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-brand-black">
                        {resumoComAutorResolvido(a.resumo, autorResolvido)}
                      </span>
                      <span className="shrink-0 text-xs text-brand-gray-500">
                        {formatDataHora(a.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-brand-gray-500">
                      {TIPO_LABEL[a.tipo]} · {ENTIDADE_LABEL[a.entidade]} · {ORIGEM_LABEL[a.origem]}
                      {autorResolvido ? ` · por ${autorResolvido}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
