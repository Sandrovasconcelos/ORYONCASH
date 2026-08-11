import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { formatDataHoraBrasil } from "@/lib/format-date";
import {
  deleteDespesaAction,
  excluirComprovanteDespesaAction,
  reclassificarComprovanteDespesaAction,
  updateDespesaAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { ActionIcon } from "../action-icon";
import { DeleteButton } from "./delete-button";
import { OpenDespesaModalButton } from "./open-despesa-modal-button";
import { SubmitButton } from "../submit-button";
import { PorPaginaSelect } from "./por-pagina-select";

export const dynamic = "force-dynamic";

function valorInputBR(valor: number) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDataBR(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function numerosPaginacao(atual: number, total: number): (number | "...")[] {
  const paginas = new Set<number>([1, total, atual, atual - 1, atual + 1]);
  const ordenadas = [...paginas].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const resultado: (number | "...")[] = [];
  let anterior = 0;
  for (const p of ordenadas) {
    if (anterior && p - anterior > 1) resultado.push("...");
    resultado.push(p);
    anterior = p;
  }
  return resultado;
}

type ComprovanteQueryRow = {
  id: string;
  despesa_id: string | null;
  tipo_documento: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  nome_arquivo: string | null;
  conta_origem_banco?: string | null;
  conta_origem_titular?: string | null;
  conta_origem_documento?: string | null;
  conta_origem_agencia?: string | null;
  conta_origem_numero?: string | null;
  metodo_pagamento?: string | null;
  numero_documento?: string | null;
};

type FornecedorDados = {
  nome: string;
  cnpj: string | null;
  cpf: string | null;
  chave_pix: string | null;
  conta_banco: string | null;
  conta_agencia: string | null;
  conta_numero: string | null;
} | null;

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{
    obra?: string;
    categoria?: string;
    etapa?: string;
    material?: string;
    fornecedor?: string;
    busca?: string;
    pagina?: string;
    porPagina?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const [
    { data: obras },
    { data: categorias },
    { data: materiais },
    { data: fornecedores },
    { data: etapas },
    { data: contasBancarias },
    despesasQuery,
  ] = await Promise.all([
    supabase.from("obras").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("categorias").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("materiais").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("etapas").select("id, nome, obra_id").is("deleted_at", null).order("ordem"),
    supabase
      .from("contas_bancarias")
      .select("id, nome")
      .is("deleted_at", null)
      .order("nome")
      .then((res) => (res.error ? { data: [] } : res)),
    (async () => {
      let queryCompleta = supabase
        .from("despesas")
        .select(
          "id, obra_id, categoria_id, etapa_id, material_id, fornecedor_id, conta_bancaria_id, valor, descricao, data, origem, created_at, criado_por_nome, criado_por_telefone, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome, cnpj, cpf, chave_pix, conta_banco, conta_agencia, conta_numero), contas_bancarias(nome)"
        )
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (params.obra) queryCompleta = queryCompleta.eq("obra_id", params.obra);
      if (params.categoria) queryCompleta = queryCompleta.eq("categoria_id", params.categoria);
      if (params.etapa) queryCompleta = queryCompleta.eq("etapa_id", params.etapa);
      if (params.material) queryCompleta = queryCompleta.eq("material_id", params.material);
      if (params.fornecedor) queryCompleta = queryCompleta.eq("fornecedor_id", params.fornecedor);

      const resultadoCompleto = await queryCompleta;
      if (!resultadoCompleto.error) return resultadoCompleto;

      // Ou as colunas novas do fornecedor (cpf/chave_pix/conta_*) ou a
      // migration de contas bancarias podem nao existir ainda - tenta sem
      // conta bancaria primeiro (preserva os dados do fornecedor).
      let querySemContaBancaria = supabase
        .from("despesas")
        .select(
          "id, obra_id, categoria_id, etapa_id, material_id, fornecedor_id, valor, descricao, data, origem, created_at, criado_por_nome, criado_por_telefone, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome, cnpj, cpf, chave_pix, conta_banco, conta_agencia, conta_numero)"
        )
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (params.obra) querySemContaBancaria = querySemContaBancaria.eq("obra_id", params.obra);
      if (params.categoria) querySemContaBancaria = querySemContaBancaria.eq("categoria_id", params.categoria);
      if (params.etapa) querySemContaBancaria = querySemContaBancaria.eq("etapa_id", params.etapa);
      if (params.material) querySemContaBancaria = querySemContaBancaria.eq("material_id", params.material);
      if (params.fornecedor) querySemContaBancaria = querySemContaBancaria.eq("fornecedor_id", params.fornecedor);

      const resultadoSemContaBancaria = await querySemContaBancaria;
      if (!resultadoSemContaBancaria.error) return resultadoSemContaBancaria;

      // Colunas novas do fornecedor (cpf/chave_pix/conta_*) tambem podem nao
      // existir ainda - refaz so com os campos ja garantidos.
      let queryReduzida = supabase
        .from("despesas")
        .select(
          "id, obra_id, categoria_id, etapa_id, material_id, fornecedor_id, valor, descricao, data, origem, created_at, criado_por_nome, criado_por_telefone, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome)"
        )
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (params.obra) queryReduzida = queryReduzida.eq("obra_id", params.obra);
      if (params.categoria) queryReduzida = queryReduzida.eq("categoria_id", params.categoria);
      if (params.etapa) queryReduzida = queryReduzida.eq("etapa_id", params.etapa);
      if (params.material) queryReduzida = queryReduzida.eq("material_id", params.material);
      if (params.fornecedor) queryReduzida = queryReduzida.eq("fornecedor_id", params.fornecedor);
      return queryReduzida;
    })(),
  ]);

  const despesasBrutas = despesasQuery.data ?? [];

  // Busca os comprovantes de TODAS as despesas candidatas (antes do filtro de
  // busca) para poder buscar tambem por numero do documento/CNPJ do emissor -
  // nao so pelos campos ja carregados na despesa.
  const idsDespesasBrutas = despesasBrutas.map((d) => d.id);
  const comprovantesQuery =
    idsDespesasBrutas.length > 0
      ? await (async () => {
          const queryComContaOrigem = await supabase
            .from("despesa_comprovantes")
            .select("id, despesa_id, tipo_documento, storage_bucket, storage_path, mime_type, nome_arquivo, conta_origem_banco, conta_origem_titular, conta_origem_documento, conta_origem_agencia, conta_origem_numero, metodo_pagamento, numero_documento")
            .in("despesa_id", idsDespesasBrutas)
            .order("created_at", { ascending: false });

          if (!queryComContaOrigem.error) return queryComContaOrigem;

          return supabase
            .from("despesa_comprovantes")
            .select("id, despesa_id, tipo_documento, storage_bucket, storage_path, mime_type, nome_arquivo")
            .in("despesa_id", idsDespesasBrutas)
            .order("created_at", { ascending: false });
        })()
      : { data: [], error: null };
  const comprovantes = comprovantesQuery.data ?? [];
  const comprovantesIndisponiveis =
    comprovantesQuery.error?.code === "PGRST205" ||
    comprovantesQuery.error?.message?.toLowerCase().includes("despesa_comprovantes");
  const comprovantesPorDespesa = new Map<
    string,
    Array<{
      id: string;
      tipo_documento: string;
      storage_bucket: string;
      storage_path: string;
      mime_type: string;
      nome_arquivo: string | null;
      conta_origem_banco: string | null;
      conta_origem_titular: string | null;
      conta_origem_documento: string | null;
      conta_origem_agencia: string | null;
      conta_origem_numero: string | null;
      metodo_pagamento: string | null;
      numero_documento: string | null;
      url: string | null;
    }>
  >();

  // Monta o mapa sem gerar signed URL ainda - isso so precisa acontecer pros
  // comprovantes da pagina atual (depois do filtro de busca + paginacao),
  // que e feito mais abaixo. Antes disso, o mapa so serve pra buscar por
  // numero_documento/conta_origem_documento e agrupar por nota, nenhum dos
  // dois depende de URL assinada.
  for (const comprovanteBase of comprovantes ?? []) {
    const comprovante = comprovanteBase as ComprovanteQueryRow;
    if (!comprovante.despesa_id) {
      continue;
    }
    const listaAtual = comprovantesPorDespesa.get(comprovante.despesa_id) ?? [];
    listaAtual.push({
      id: comprovante.id,
      tipo_documento: comprovante.tipo_documento,
      storage_bucket: comprovante.storage_bucket,
      storage_path: comprovante.storage_path,
      mime_type: comprovante.mime_type,
      nome_arquivo: comprovante.nome_arquivo,
      conta_origem_banco: comprovante.conta_origem_banco ?? null,
      conta_origem_titular: comprovante.conta_origem_titular ?? null,
      conta_origem_documento: comprovante.conta_origem_documento ?? null,
      conta_origem_agencia: comprovante.conta_origem_agencia ?? null,
      conta_origem_numero: comprovante.conta_origem_numero ?? null,
      metodo_pagamento: comprovante.metodo_pagamento ?? null,
      numero_documento: comprovante.numero_documento ?? null,
      url: null,
    });
    comprovantesPorDespesa.set(comprovante.despesa_id, listaAtual);
  }

  const normalizar = (texto: string) =>
    texto
      .normalize("NFD")
      .replace(/\p{Mn}/gu, "")
      .toLowerCase();
  const termoBusca = normalizar((params.busca ?? "").trim());

  const despesas = termoBusca
    ? despesasBrutas.filter((d) => {
        const fornecedorDados = d.fornecedores as unknown as FornecedorDados;
        const comprovantesDaDespesa = comprovantesPorDespesa.get(d.id) ?? [];
        const campos = [
          d.descricao,
          (d.obras as unknown as { nome: string } | null)?.nome,
          (d.categorias as unknown as { nome: string } | null)?.nome,
          (d.etapas as unknown as { nome: string } | null)?.nome,
          (d.materiais as unknown as { nome: string } | null)?.nome,
          fornecedorDados?.nome,
          fornecedorDados?.cnpj,
          fornecedorDados?.cpf,
          ...comprovantesDaDespesa.map((c) => c.numero_documento),
          ...comprovantesDaDespesa.map((c) => c.conta_origem_documento),
        ];
        return campos.some(
          (campo) => campo && normalizar(campo).includes(termoBusca)
        );
      })
    : despesasBrutas;
  const totalFiltrado = despesas.reduce((soma, d) => soma + d.valor, 0);

  // Varios itens de uma mesma nota/comprovante viram varias despesas
  // (uma por item). Elas compartilham o mesmo arquivo (storage_path) em
  // despesa_comprovantes - usa isso pra agrupar visualmente sem precisar
  // de uma coluna nova no banco.
  const PALETA_GRUPOS_NOTA = ["#296dd1", "#7c3aed", "#bd7600", "#0f766e", "#c2185b", "#4d7c0f"];
  const grupoNotaPorDespesa = new Map<string, { indice: number; total: number; cor: string }>();
  {
    const idsPorChave = new Map<string, string[]>();
    for (const d of despesas) {
      const comprovantesDaDespesa = comprovantesPorDespesa.get(d.id) ?? [];
      const arquivoCompartilhado =
        comprovantesDaDespesa.find((c) => c.tipo_documento === "documento_cobranca") ??
        comprovantesDaDespesa.find((c) => c.tipo_documento === "comprovante_pagamento");
      if (!arquivoCompartilhado) continue;
      const chave = `${arquivoCompartilhado.storage_bucket}/${arquivoCompartilhado.storage_path}`;
      const lista = idsPorChave.get(chave) ?? [];
      lista.push(d.id);
      idsPorChave.set(chave, lista);
    }
    let corIndex = 0;
    for (const ids of idsPorChave.values()) {
      if (ids.length < 2) continue;
      const cor = PALETA_GRUPOS_NOTA[corIndex % PALETA_GRUPOS_NOTA.length];
      ids.forEach((despesaId, i) => {
        grupoNotaPorDespesa.set(despesaId, { indice: i + 1, total: ids.length, cor });
      });
      corIndex += 1;
    }
  }

  const TAMANHOS_PAGINA = [10, 20, 50, 100];
  const porPagina = TAMANHOS_PAGINA.includes(Number(params.porPagina))
    ? Number(params.porPagina)
    : 20;
  const totalPaginas = Math.max(1, Math.ceil(despesas.length / porPagina));
  const paginaSolicitada = Number(params.pagina);
  const paginaAtual =
    Number.isFinite(paginaSolicitada) && paginaSolicitada >= 1
      ? Math.min(paginaSolicitada, totalPaginas)
      : 1;
  const inicioPagina = (paginaAtual - 1) * porPagina;
  const despesasPagina = despesas.slice(inicioPagina, inicioPagina + porPagina);

  // So gera signed URL pros comprovantes que vao realmente aparecer na tela
  // (a pagina atual), em paralelo - antes disso rodava sequencialmente pra
  // TODOS os comprovantes de ate 1000 despesas em toda visita a pagina,
  // que era o principal motivo da demora nas buscas e filtros.
  const comprovantesDaPaginaAtual = despesasPagina.flatMap(
    (d) => comprovantesPorDespesa.get(d.id) ?? []
  );
  await Promise.all(
    comprovantesDaPaginaAtual.map(async (comprovante) => {
      const { data: signed } = await supabase.storage
        .from(comprovante.storage_bucket)
        .createSignedUrl(comprovante.storage_path, 60 * 60);
      comprovante.url = signed?.signedUrl ?? null;
    })
  );

  const hrefComOverrides = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
      if (valor) sp.set(chave, valor);
    }
    for (const [chave, valor] of Object.entries(overrides)) {
      if (valor) sp.set(chave, valor);
      else sp.delete(chave);
    }
    const qs = sp.toString();
    return `/dashboard/despesas${qs ? `?${qs}` : ""}`;
  };

  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][]
  ).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-black">Lançamentos</p>
            <p className="mt-1 text-xs text-brand-gray-500">
              Visualize, filtre, edite e gere relatório das despesas registradas.
            </p>
          </div>
          <div className="rounded-brand-sm bg-brand-gray-100 px-4 py-2 text-right">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-gray-500">
              Total filtrado
            </p>
            <p className="font-display text-lg font-bold text-brand-red">
              {formatBRL(totalFiltrado)}
            </p>
          </div>
        </div>

        <form className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-full flex-1 basis-full flex-col gap-1 text-xs font-semibold text-brand-gray-500 sm:min-w-64 sm:basis-auto">
            Buscar
            <input
              type="text"
              name="busca"
              defaultValue={params.busca ?? ""}
              placeholder="Nome do item, material, fornecedor ou descrição"
              className="w-full rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm font-normal text-brand-black outline-none focus:border-brand-red"
            />
          </label>

          <label className="flex min-w-48 flex-col gap-1 text-xs font-semibold text-brand-gray-500">
            Obra
            <select
              name="obra"
              defaultValue={params.obra ?? ""}
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm font-normal text-brand-black outline-none focus:border-brand-red"
            >
              <option value="">Todas as obras</option>
              {(obras ?? []).map((obra) => (
                <option key={obra.id} value={obra.id}>
                  {obra.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-48 flex-col gap-1 text-xs font-semibold text-brand-gray-500">
            Categoria
            <select
              name="categoria"
              defaultValue={params.categoria ?? ""}
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm font-normal text-brand-black outline-none focus:border-brand-red"
            >
              <option value="">Todas as categorias</option>
              {(categorias ?? []).map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-56 flex-col gap-1 text-xs font-semibold text-brand-gray-500">
            Material
            <select
              name="material"
              defaultValue={params.material ?? ""}
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm font-normal text-brand-black outline-none focus:border-brand-red"
            >
              <option value="">Todos os materiais</option>
              {(materiais ?? []).map((material) => (
                <option key={material.id} value={material.id}>
                  {material.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-brand-gray-500">
            Exibir
            <PorPaginaSelect valor={porPagina} />
          </label>

          <button
            type="submit"
            className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700"
          >
            Filtrar
          </button>

          <Link
            href={`/dashboard/despesas/relatorio${queryString ? `?${queryString}` : ""}`}
            className="rounded-brand-sm border border-brand-gray-300 bg-white px-4 py-2 text-sm font-semibold text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
          >
            Gerar relatório
          </Link>

          {queryString && (
            <Link
              href="/dashboard/despesas"
              className="px-2 py-2 text-sm font-medium text-brand-gray-500 hover:text-brand-red"
            >
              Limpar
            </Link>
          )}
        </form>

        <p className="mt-3 text-xs font-medium text-brand-gray-500">
          {despesas.length} lançamento(s) encontrados
          {despesas.length > 0 &&
            ` — mostrando ${inicioPagina + 1}–${Math.min(inicioPagina + porPagina, despesas.length)}`}
          .
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-brand-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-brand-sm border border-status-info/25 bg-white text-status-info">
              <ActionIcon name="file" />
            </span>
            Conta / nota
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-brand-sm border border-status-success/25 bg-[#e9f8f0] text-status-success">
              <ActionIcon name="payment" />
            </span>
            Comprovante de pagamento
          </span>
        </div>
      </div>

      {comprovantesIndisponiveis && (
        <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm leading-6 text-brand-gray-700 shadow-card">
          <p className="font-semibold text-brand-black">Comprovantes ainda não ativados no Supabase.</p>
          <p className="mt-1">
            A tabela <code className="rounded bg-white/70 px-1">despesa_comprovantes</code> não existe no banco.
            Aplique a migration <code className="rounded bg-white/70 px-1">supabase/migrations/20260727020000_etapas_e_comprovantes.sql</code> para o WhatsApp salvar contas, notas e comprovantes de pagamento.
          </p>
        </div>
      )}

      <div className="overflow-hidden overflow-x-auto rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500">
            <tr>
              <th className="px-5 py-3 font-extrabold">Data</th>
              <th className="px-5 py-3 font-extrabold">Lançamento</th>
              <th className="px-5 py-3 font-extrabold">Classificação</th>
              <th className="px-5 py-3 font-extrabold">Material / Fornecedor</th>
              <th className="px-5 py-3 text-right font-extrabold">Valor</th>
              <th className="px-5 py-3 font-extrabold">Comprovante</th>
              <th className="px-5 py-3 font-extrabold">Conta</th>
              <th className="px-5 py-3 font-extrabold">Origem</th>
              <th className="px-5 py-3 font-extrabold">Registrado</th>
              <th className="px-5 py-3 text-right font-extrabold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-gray-300/40">
            {despesasPagina.map((d) => {
              const obraNome = (d.obras as unknown as { nome: string } | null)?.nome ?? "-";
              const categoriaNome =
                (d.categorias as unknown as { nome: string } | null)?.nome ?? "-";
              const etapaNome = (d.etapas as unknown as { nome: string } | null)?.nome ?? "-";
              const materialNome =
                (d.materiais as unknown as { nome: string } | null)?.nome ?? "-";
              const fornecedorDados = d.fornecedores as unknown as FornecedorDados;
              const fornecedorNome = fornecedorDados?.nome ?? "-";
              const contaBancariaInfo = d as unknown as {
                conta_bancaria_id: string | null;
                contas_bancarias: { nome: string } | null;
              };
              const comprovantesDaDespesa = comprovantesPorDespesa.get(d.id) ?? [];
              const documentosCobranca = comprovantesDaDespesa.filter(
                (item) => item.tipo_documento === "documento_cobranca"
              );
              const comprovantesPagamento = comprovantesDaDespesa.filter(
                (item) => item.tipo_documento === "comprovante_pagamento"
              );
              const etapasDaDespesa = (etapas ?? []).filter(
                (etapa) => etapa.obra_id === d.obra_id || etapa.obra_id === null
              );
              const grupoNota = grupoNotaPorDespesa.get(d.id);

              return (
                <tr key={d.id} className="align-top hover:bg-brand-gray-100/60">
                  <td
                    className="whitespace-nowrap px-5 py-4 font-semibold text-brand-black"
                    style={grupoNota ? { boxShadow: `inset 4px 0 0 0 ${grupoNota.cor}` } : undefined}
                  >
                    {formatDataBR(d.data)}
                  </td>
                  <td className="px-5 py-4">
                    <OpenDespesaModalButton despesaId={d.id}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-brand-sm bg-brand-red/10 text-brand-red">
                          <ActionIcon name="receipt" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-brand-black">{obraNome}</p>
                          <p className="mt-1 max-w-[280px] truncate text-xs text-brand-gray-500">
                            {d.descricao ?? "Sem descrição"}
                          </p>
                          <p className="mt-1 text-[11px] font-bold text-brand-red">
                            Clique para ver detalhes
                          </p>
                          {grupoNota && (
                            <p
                              className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                              style={{ background: `${grupoNota.cor}1a`, color: grupoNota.cor }}
                            >
                              🧾 Mesma nota · {grupoNota.indice}/{grupoNota.total}
                            </p>
                          )}
                        </div>
                      </div>
                    </OpenDespesaModalButton>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex w-fit rounded-full bg-brand-red/10 px-3 py-1 text-xs font-bold text-brand-red">
                        {categoriaNome}
                      </span>
                      <span className="text-xs leading-5 text-brand-gray-500">{etapaNome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="max-w-[260px] font-medium text-brand-black">{materialNome}</p>
                    <p className="mt-1 max-w-[260px] truncate text-xs text-brand-gray-500">
                      {fornecedorNome}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <p className="font-display text-lg font-bold text-brand-black">
                      {formatBRL(d.valor)}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {documentosCobranca[0]?.url ? (
                        <Link
                          href={documentosCobranca[0].url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Ver conta ou nota"
                          title="Ver conta ou nota"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-status-info/25 bg-white text-status-info hover:bg-status-info hover:text-white"
                        >
                          <ActionIcon name="file" />
                        </Link>
                      ) : (
                        <span
                          aria-label="Sem conta ou nota"
                          title="Sem conta ou nota"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-brand-gray-300 bg-brand-gray-100 text-brand-gray-500"
                        >
                          <ActionIcon name="file" />
                        </span>
                      )}
                      {comprovantesPagamento[0]?.url ? (
                        <Link
                          href={comprovantesPagamento[0].url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Ver comprovante de pagamento"
                          title="Ver comprovante de pagamento"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-status-success/25 bg-[#e9f8f0] text-status-success hover:bg-status-success hover:text-white"
                        >
                          <ActionIcon name="payment" />
                        </Link>
                      ) : (
                        <span
                          aria-label="Comprovante de pagamento pendente"
                          title="Comprovante de pagamento pendente"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-brand-sm border border-status-warning/25 bg-status-warning/10 text-status-warning"
                        >
                          <ActionIcon name="payment" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {contaBancariaInfo.contas_bancarias?.nome ? (
                      <span className="inline-flex w-fit rounded-full bg-status-info/10 px-3 py-1 text-xs font-bold text-status-info">
                        {contaBancariaInfo.contas_bancarias.nome}
                      </span>
                    ) : (
                      <span className="inline-flex w-fit rounded-full bg-brand-gray-100 px-3 py-1 text-xs font-bold text-brand-gray-500">
                        Sem conta
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={
                          d.origem === "whatsapp"
                            ? "inline-flex w-fit rounded-full bg-[#e9f8f0] px-3 py-1 text-xs font-bold capitalize text-status-success"
                            : "inline-flex w-fit rounded-full bg-brand-gray-100 px-3 py-1 text-xs font-bold capitalize text-brand-gray-700"
                        }
                      >
                        {d.origem}
                      </span>
                      <span className="max-w-[180px] truncate text-xs text-brand-gray-500">
                        por {d.criado_por_nome || d.criado_por_telefone || "Dashboard"}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-brand-gray-500">
                    {formatDataHoraBrasil(d.created_at)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <CadastroModal
                        titulo="Editar lançamento"
                        descricao="Ajuste obra, categoria, etapa, material, fornecedor, valor e descrição."
                        botao="Editar"
                        icone={<ActionIcon name="edit" />}
                        variante="icone"
                        triggerId={`despesa-${d.id}`}
                        modalSize="wide"
                      >
                        <form action={updateDespesaAction} className="space-y-5">
                          <input type="hidden" name="id" value={d.id} />
                          <div className="rounded-brand-sm border border-brand-gray-300/70 bg-brand-gray-100/60 p-4 sm:col-span-2">
                            <p className="text-sm font-bold text-brand-black">Resumo do lançamento</p>
                            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray-400">Criado por</p>
                                <p className="mt-1 font-semibold text-brand-black">{d.criado_por_nome || d.criado_por_telefone || "Dashboard"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray-400">Origem</p>
                                <p className="mt-1 font-semibold capitalize text-brand-black">{d.origem}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray-400">Registrado em</p>
                                <p className="mt-1 font-semibold text-brand-black">{formatDataHoraBrasil(d.created_at)}</p>
                              </div>
                            </div>
                          </div>
                          {fornecedorDados &&
                            (fornecedorDados.cnpj ||
                              fornecedorDados.cpf ||
                              fornecedorDados.chave_pix ||
                              fornecedorDados.conta_banco) && (
                              <div className="rounded-brand-sm border border-brand-gray-300/70 bg-brand-gray-100/60 p-4 sm:col-span-2">
                                <p className="text-sm font-bold text-brand-black">
                                  Dados do fornecedor rastreados do recibo/comprovante
                                </p>
                                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
                                  {fornecedorDados.cnpj && (
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray-400">CNPJ</p>
                                      <p className="mt-1 font-semibold text-brand-black">{fornecedorDados.cnpj}</p>
                                    </div>
                                  )}
                                  {fornecedorDados.cpf && (
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray-400">CPF</p>
                                      <p className="mt-1 font-semibold text-brand-black">{fornecedorDados.cpf}</p>
                                    </div>
                                  )}
                                  {fornecedorDados.chave_pix && (
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray-400">Chave Pix</p>
                                      <p className="mt-1 font-semibold text-brand-black">{fornecedorDados.chave_pix}</p>
                                    </div>
                                  )}
                                  {fornecedorDados.conta_banco && (
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray-400">Conta</p>
                                      <p className="mt-1 font-semibold text-brand-black">
                                        {[
                                          fornecedorDados.conta_banco,
                                          fornecedorDados.conta_agencia,
                                          fornecedorDados.conta_numero,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          <div className="rounded-brand border border-brand-gray-300/70 bg-white p-5">
                            <div className="mb-4">
                              <p className="text-sm font-extrabold text-brand-black">Dados do lançamento</p>
                              <p className="mt-1 text-xs text-brand-gray-500">Edite classificação, valor, data e descrição.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Obra
                            <select
                              name="obra_id"
                              defaultValue={d.obra_id}
                              required
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            >
                              {(obras ?? []).map((obra) => (
                                <option key={obra.id} value={obra.id}>
                                  {obra.nome}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Categoria
                            <select
                              name="categoria_id"
                              defaultValue={d.categoria_id}
                              required
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            >
                              {(categorias ?? []).map((categoria) => (
                                <option key={categoria.id} value={categoria.id}>
                                  {categoria.nome}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Etapa
                            <select
                              name="etapa_id"
                              defaultValue={d.etapa_id ?? ""}
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            >
                              <option value="">Sem etapa</option>
                              {etapasDaDespesa.map((etapa) => (
                                <option key={etapa.id} value={etapa.id}>
                                  {etapa.nome}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Material
                            <select
                              name="material_id"
                              defaultValue={d.material_id ?? ""}
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            >
                              <option value="">Sem material</option>
                              {(materiais ?? []).map((material) => (
                                <option key={material.id} value={material.id}>
                                  {material.nome}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Fornecedor
                            <select
                              name="fornecedor_id"
                              defaultValue={d.fornecedor_id ?? ""}
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            >
                              <option value="">Sem fornecedor</option>
                              {(fornecedores ?? []).map((fornecedor) => (
                                <option key={fornecedor.id} value={fornecedor.id}>
                                  {fornecedor.nome}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Conta bancária
                            <select
                              name="conta_bancaria_id"
                              defaultValue={contaBancariaInfo.conta_bancaria_id ?? ""}
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            >
                              <option value="">Sem conta</option>
                              {(contasBancarias ?? []).map((conta) => (
                                <option key={conta.id} value={conta.id}>
                                  {conta.nome}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Data
                            <input
                              type="date"
                              name="data"
                              defaultValue={d.data}
                              required
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Valor
                            <input
                              name="valor"
                              defaultValue={valorInputBR(d.valor)}
                              required
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700 sm:col-span-2">
                            Descrição
                            <textarea
                              name="descricao"
                              defaultValue={d.descricao ?? ""}
                              rows={3}
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            />
                          </label>
                            </div>
                          </div>
                          <div className="rounded-brand border border-brand-gray-300/70 bg-brand-gray-100/60 p-5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-brand-black">Documentos do lançamento</p>
                                <p className="mt-1 text-xs leading-5 text-brand-gray-500">
                                  Organize o que é cobrança e o que comprova o pagamento.
                                </p>
                              </div>
                              <span className="mt-1 inline-flex w-fit rounded-full bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-gray-500">
                                {comprovantesDaDespesa.length} arquivo(s)
                              </span>
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                {[
                                  {
                                    tipo: "documento_cobranca",
                                    titulo: "Conta / nota",
                                    descricao: "Nota fiscal, boleto, conta de luz ou cobrança original.",
                                    icone: "file" as const,
                                    cor: "text-status-info",
                                    bg: "bg-status-info/10",
                                    borda: "border-status-info/20",
                                    vazio: "Nenhuma conta ou nota vinculada.",
                                    acao: "Mover para conta",
                                  },
                                  {
                                    tipo: "comprovante_pagamento",
                                    titulo: "Comprovante de pagamento",
                                    descricao: "Pix, recibo bancário ou confirmação de pagamento.",
                                    icone: "payment" as const,
                                    cor: "text-status-success",
                                    bg: "bg-status-success/10",
                                    borda: "border-status-success/20",
                                    vazio: "Pagamento ainda sem comprovante.",
                                    acao: "Mover para pagamento",
                                  },
                                ].map((grupo) => {
                                  const arquivosDoTipo = comprovantesDaDespesa.filter(
                                    (comprovante) => comprovante.tipo_documento === grupo.tipo
                                  );
                                  const outrosArquivos = comprovantesDaDespesa.filter(
                                    (comprovante) => comprovante.tipo_documento !== grupo.tipo
                                  );

                                  return (
                                    <div
                                      key={grupo.tipo}
                                      className={`rounded-brand border ${grupo.borda} bg-white p-4 shadow-sm`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <span
                                          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-sm ${grupo.bg} ${grupo.cor}`}
                                        >
                                          <ActionIcon name={grupo.icone} />
                                        </span>
                                        <div className="min-w-0">
                                          <p className="text-sm font-extrabold text-brand-black">{grupo.titulo}</p>
                                          <p className="mt-1 text-xs leading-5 text-brand-gray-500">{grupo.descricao}</p>
                                        </div>
                                      </div>

                                      <div className="mt-4 flex flex-col gap-2">
                                        {arquivosDoTipo.length > 0 ? (
                                          arquivosDoTipo.map((comprovante, index) => (
                                            <div
                                              key={comprovante.id}
                                              className="flex items-center justify-between gap-3 rounded-brand-sm bg-brand-gray-100 px-3 py-2"
                                            >
                                              <div className="min-w-0">
                                                <p className="truncate text-xs font-bold text-brand-black">
                                                  {comprovante.nome_arquivo || `Arquivo ${index + 1}`}
                                                </p>
                                                <p className="text-[11px] text-brand-gray-500">
                                                  Classificação correta
                                                </p>
                                                {grupo.tipo === "comprovante_pagamento" &&
                                                  (comprovante.conta_origem_banco ||
                                                    comprovante.conta_origem_titular ||
                                                    comprovante.metodo_pagamento) && (
                                                    <p className="mt-1 text-[11px] leading-4 text-brand-gray-600">
                                                      Origem: {[comprovante.conta_origem_banco, comprovante.conta_origem_titular]
                                                        .filter(Boolean)
                                                        .join(" | ")}
                                                      {comprovante.metodo_pagamento
                                                        ? ` | ${comprovante.metodo_pagamento}`
                                                        : ""}
                                                    </p>
                                                  )}
                                                {comprovante.numero_documento && (
                                                  <p className="mt-1 text-[11px] leading-4 text-brand-gray-600">
                                                    Nº do documento: {comprovante.numero_documento}
                                                  </p>
                                                )}
                                              </div>
                                              <div className="flex shrink-0 items-center gap-2">
                                                {comprovante.url && (
                                                  <Link
                                                    href={comprovante.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-brand-sm border border-brand-gray-300 bg-white text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
                                                    aria-label={`Ver ${grupo.titulo.toLowerCase()}`}
                                                    title={`Ver ${grupo.titulo.toLowerCase()}`}
                                                  >
                                                    <ActionIcon name="file" />
                                                  </Link>
                                                )}
                                                <button
                                                  type="submit"
                                                  formAction={excluirComprovanteDespesaAction.bind(null, comprovante.id)}
                                                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-brand-sm border border-status-danger/30 bg-white text-status-danger hover:bg-status-danger/10"
                                                  aria-label={`Excluir ${grupo.titulo.toLowerCase()}`}
                                                  title={`Excluir (pra substituir, anexe o correto abaixo depois)`}
                                                >
                                                  <ActionIcon name="trash" />
                                                </button>
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="rounded-brand-sm border border-dashed border-brand-gray-300 bg-brand-gray-100/70 px-3 py-3 text-xs text-brand-gray-500">
                                            {grupo.vazio}
                                          </div>
                                        )}
                                      </div>

                                      {outrosArquivos.length > 0 && (
                                        <div className="mt-3 border-t border-brand-gray-300/70 pt-3">
                                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray-400">
                                            Corrigir classificação
                                          </p>
                                          <div className="flex flex-wrap gap-2">
                                            {outrosArquivos.map((comprovante) => (
                                              <button
                                                key={comprovante.id}
                                                type="submit"
                                                formAction={reclassificarComprovanteDespesaAction.bind(
                                                  null,
                                                  comprovante.id,
                                                  grupo.tipo
                                                )}
                                                className={`inline-flex items-center gap-2 rounded-brand-sm border ${grupo.borda} bg-white px-3 py-2 text-xs font-bold ${grupo.cor} hover:bg-brand-gray-100`}
                                              >
                                                <ActionIcon name={grupo.icone} />
                                                {grupo.acao}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      <div className="mt-3 border-t border-brand-gray-300/70 pt-3">
                                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gray-400">
                                          Anexar pelo app
                                        </p>
                                        <div className="flex flex-col gap-2">
                                          <input
                                            type="file"
                                            name={`arquivo_${grupo.tipo}`}
                                            accept="image/*,application/pdf"
                                            className="block w-full rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-xs text-brand-gray-600 file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-brand-black hover:file:bg-brand-gray-200"
                                          />
                                          <p className="rounded-brand-sm bg-white px-3 py-2 text-[11px] leading-5 text-brand-gray-500">
                                            Escolha um arquivo e clique em <strong>Salvar alterações</strong> para anexar.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                          </div>
                          <input type="hidden" name="despesa_id" value={d.id} />
                          <SubmitButton className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700 sm:col-span-2">
                            Salvar edição
                          </SubmitButton>
                        </form>
                      </CadastroModal>
                      <DeleteButton despesaId={d.id} action={deleteDespesaAction} />
                    </div>
                  </td>
                </tr>
              );
            })}

            {despesas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-sm text-brand-gray-500">
                  Nenhum lançamento encontrado para os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-gray-300/60 bg-white px-5 py-4 shadow-card">
          <p className="text-xs font-medium text-brand-gray-500">
            Página {paginaAtual} de {totalPaginas}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={hrefComOverrides({ pagina: String(Math.max(1, paginaAtual - 1)) })}
              className={`rounded-brand-sm border px-3 py-1.5 text-xs font-bold ${
                paginaAtual === 1
                  ? "pointer-events-none border-brand-gray-300 text-brand-gray-300"
                  : "border-brand-gray-300 text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
              }`}
            >
              Anterior
            </Link>
            {numerosPaginacao(paginaAtual, totalPaginas).map((item, index) =>
              item === "..." ? (
                <span key={`ellipsis-${index}`} className="px-2 text-xs text-brand-gray-400">
                  …
                </span>
              ) : (
                <Link
                  key={item}
                  href={hrefComOverrides({ pagina: String(item) })}
                  className={`rounded-brand-sm border px-3 py-1.5 text-xs font-bold ${
                    item === paginaAtual
                      ? "border-brand-red bg-brand-red text-white"
                      : "border-brand-gray-300 text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
                  }`}
                >
                  {item}
                </Link>
              )
            )}
            <Link
              href={hrefComOverrides({ pagina: String(Math.min(totalPaginas, paginaAtual + 1)) })}
              className={`rounded-brand-sm border px-3 py-1.5 text-xs font-bold ${
                paginaAtual === totalPaginas
                  ? "pointer-events-none border-brand-gray-300 text-brand-gray-300"
                  : "border-brand-gray-300 text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
              }`}
            >
              Próxima
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
