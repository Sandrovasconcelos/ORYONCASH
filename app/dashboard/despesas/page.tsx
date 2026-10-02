import Link from "next/link";
import { Fragment } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { rotuloOrigem } from "@/lib/origem";
import { createDespesaAction, deleteDespesaAction } from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { ActionIcon } from "../action-icon";
import { IconeNome } from "../icone-svg";
import { FormularioEdicao } from "./formulario-edicao";
import { DeleteButton } from "./delete-button";
import { OpenDespesaModalButton } from "./open-despesa-modal-button";
import { SubmitButton } from "../submit-button";
import { PorPaginaSelect } from "./por-pagina-select";
import { SelecaoLancamentosProvider } from "./selecao-context";
import { DespesaCheckbox, SelecionarTodosCheckbox } from "./despesa-checkbox";
import { SelecaoActionBar } from "./selecao-action-bar";
import { carregarNotas } from "@/lib/despesas/notas";
import { consultarEmLotes } from "@/lib/supabase/emLotes";

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
    data?: string;
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
          "id, obra_id, categoria_id, etapa_id, material_id, fornecedor_id, conta_bancaria_id, valor, quantidade, valor_unitario, descricao, data, origem, created_at, criado_por_nome, criado_por_telefone, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome, cnpj, cpf, chave_pix, conta_banco, conta_agencia, conta_numero), contas_bancarias(nome)"
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
      if (params.data) queryCompleta = queryCompleta.eq("data", params.data);

      const resultadoCompleto = await queryCompleta;
      if (!resultadoCompleto.error) return resultadoCompleto;

      // Migration de quantidade/valor_unitario pode nao ter rodado ainda -
      // tenta sem esses dois primeiro (preserva conta bancaria e fornecedor).
      let querySemQuantidade = supabase
        .from("despesas")
        .select(
          "id, obra_id, categoria_id, etapa_id, material_id, fornecedor_id, conta_bancaria_id, valor, descricao, data, origem, created_at, criado_por_nome, criado_por_telefone, obras(nome), categorias(nome), etapas(nome), materiais(nome), fornecedores(nome, cnpj, cpf, chave_pix, conta_banco, conta_agencia, conta_numero), contas_bancarias(nome)"
        )
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (params.obra) querySemQuantidade = querySemQuantidade.eq("obra_id", params.obra);
      if (params.categoria) querySemQuantidade = querySemQuantidade.eq("categoria_id", params.categoria);
      if (params.etapa) querySemQuantidade = querySemQuantidade.eq("etapa_id", params.etapa);
      if (params.material) querySemQuantidade = querySemQuantidade.eq("material_id", params.material);
      if (params.fornecedor) querySemQuantidade = querySemQuantidade.eq("fornecedor_id", params.fornecedor);
      if (params.data) querySemQuantidade = querySemQuantidade.eq("data", params.data);

      const resultadoSemQuantidade = await querySemQuantidade;
      if (!resultadoSemQuantidade.error) {
        return {
          ...resultadoSemQuantidade,
          data: (resultadoSemQuantidade.data ?? []).map((d) => ({
            ...d,
            quantidade: null,
            valor_unitario: null,
          })),
        };
      }

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
      if (params.data) querySemContaBancaria = querySemContaBancaria.eq("data", params.data);

      const resultadoSemContaBancaria = await querySemContaBancaria;
      if (!resultadoSemContaBancaria.error) {
        return {
          ...resultadoSemContaBancaria,
          data: (resultadoSemContaBancaria.data ?? []).map((d) => ({
            ...d,
            quantidade: null,
            valor_unitario: null,
          })),
        };
      }

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
      if (params.data) queryReduzida = queryReduzida.eq("data", params.data);
      const resultadoReduzido = await queryReduzida;
      return {
        ...resultadoReduzido,
        data: (resultadoReduzido.data ?? []).map((d) => ({
          ...d,
          conta_bancaria_id: null,
          contas_bancarias: null,
          quantidade: null,
          valor_unitario: null,
        })),
      };
    })(),
  ]);

  const despesasBrutas = despesasQuery.data ?? [];

  // Busca os comprovantes de TODAS as despesas candidatas (antes do filtro de
  // busca) para poder buscar tambem por numero do documento/CNPJ do emissor -
  // nao so pelos campos ja carregados na despesa.
  const idsDespesasBrutas = despesasBrutas.map((d) => d.id);
  // Em lotes, rodando juntos: um .in() com centenas de ids vira uma URL
  // gigante (lento e, passando do limite, falha) - e isso rodava a cada
  // abertura/salvamento da pagina.
  const COLUNAS_COMPROVANTE_COMPLETAS =
    "id, despesa_id, tipo_documento, storage_bucket, storage_path, mime_type, nome_arquivo, conta_origem_banco, conta_origem_titular, conta_origem_documento, conta_origem_agencia, conta_origem_numero, metodo_pagamento, numero_documento";
  const COLUNAS_COMPROVANTE_BASICAS =
    "id, despesa_id, tipo_documento, storage_bucket, storage_path, mime_type, nome_arquivo";
  const buscarComprovantes = (colunas: string) =>
    consultarEmLotes(idsDespesasBrutas, (lote) =>
      supabase
        .from("despesa_comprovantes")
        .select(colunas)
        .in("despesa_id", lote)
        .order("created_at", { ascending: false })
    );
  let comprovantesQuery = await buscarComprovantes(COLUNAS_COMPROVANTE_COMPLETAS);
  if (comprovantesQuery.error) comprovantesQuery = await buscarComprovantes(COLUNAS_COMPROVANTE_BASICAS);
  const comprovantes = comprovantesQuery.data as unknown as ComprovanteQueryRow[];
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
  // Nota completa (todos os itens e o total), mesmo quando o filtro/pagina mostra so parte dela.
  const promessaNotas = carregarNotas(despesasPagina.map((d) => d.id));

  // So gera signed URL pros comprovantes que vao realmente aparecer na tela
  // (a pagina atual), em paralelo - antes disso rodava sequencialmente pra
  // TODOS os comprovantes de ate 1000 despesas em toda visita a pagina,
  // que era o principal motivo da demora nas buscas e filtros.
  const comprovantesDaPaginaAtual = despesasPagina.flatMap(
    (d) => comprovantesPorDespesa.get(d.id) ?? []
  );
  // Notas e links dos arquivos sao independentes: carrega juntos.
  const [notasCompletas] = await Promise.all([
    promessaNotas,
    Promise.all(
      comprovantesDaPaginaAtual.map(async (comprovante) => {
        const { data: signed } = await supabase.storage
          .from(comprovante.storage_bucket)
          .createSignedUrl(comprovante.storage_path, 60 * 60);
        comprovante.url = signed?.signedUrl ?? null;
      })
    ),
  ]);

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
    <SelecaoLancamentosProvider>
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-black">Lançamentos</p>
            <p className="mt-1 text-xs text-brand-gray-500">
              Visualize, filtre, edite e gere relatório das despesas registradas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            <div className="rounded-brand-sm bg-brand-gray-100 px-4 py-2 text-right">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-gray-500">
                Total filtrado
              </p>
              <p className="font-display text-lg font-bold text-brand-red">
                {formatBRL(totalFiltrado)}
              </p>
            </div>
            <Link
              href="/dashboard/despesas/calendario"
              className="rounded-brand-sm border border-brand-gray-300 bg-white px-4 py-2 text-sm font-semibold text-brand-gray-700 hover:border-brand-red/40 hover:text-brand-red"
            >
              📅 Calendário
            </Link>
            <CadastroModal
              titulo="Novo lançamento"
              descricao="Registre uma despesa direto pelo dashboard."
              botao="+ Novo lançamento"
              variante="primario"
              modalSize="wide"
            >
              <form action={createDespesaAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                  Obra
                  <select name="obra_id" className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red">
                    <option value="">Sem obra (Administrativo)</option>
                    {(obras ?? []).map((obra) => (
                      <option key={obra.id} value={obra.id}>
                        {obra.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                  Categoria
                  <select name="categoria_id" required className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red">
                    <option value="">Selecione</option>
                    {(categorias ?? []).map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                  Etapa
                  <select name="etapa_id" className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red">
                    <option value="">Sem etapa</option>
                    {(etapas ?? []).map((etapa) => (
                      <option key={etapa.id} value={etapa.id}>
                        {(obras ?? []).find((o) => o.id === etapa.obra_id)?.nome ?? "?"} — {etapa.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                  Material
                  <select name="material_id" className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red">
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
                  <select name="fornecedor_id" className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red">
                    <option value="">Sem fornecedor</option>
                    {(fornecedores ?? []).map((fornecedor) => (
                      <option key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                  Data
                  <input
                    type="date"
                    name="data"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                    className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                  Valor
                  <input
                    name="valor"
                    placeholder="0,00"
                    required
                    className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                  Quantidade
                  <input
                    name="quantidade"
                    placeholder="Ex: 50"
                    className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                  Valor unitário
                  <input
                    name="valor_unitario"
                    placeholder="Ex: 53,00"
                    className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-gray-700 sm:col-span-2 lg:col-span-3">
                  Descrição
                  <textarea
                    name="descricao"
                    rows={2}
                    className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                  />
                </label>
                <div className="sm:col-span-2 lg:col-span-3">
                  <SubmitButton className="rounded-brand-sm bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-700">
                    Salvar lançamento
                  </SubmitButton>
                </div>
              </form>
            </CadastroModal>
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

      {notasCompletas.size > 0 && (
        <div className="rounded-card border border-brand-gray-300/60 bg-white px-4 py-3 text-xs text-brand-gray-600 shadow-card">
          <strong className="text-brand-black">🧾 Como ler as notas com vários itens:</strong> cada produto da nota é
          um lançamento, com o mesmo valor que está impresso nela (pra bater quando você conferir com a nota em mãos).
          O resumo em destaque acima do primeiro item mostra o total da nota, um eventual{" "}
          <span className="font-bold text-status-success">📉 desconto</span> e o comprovante — tudo isso já descontado
          no total pago. Os itens abaixo só trazem a barra colorida e a posição (ex: 3/115) pra não repetir a mesma
          informação em cada linha.
        </div>
      )}

      <div className="md:overflow-hidden md:overflow-x-auto md:rounded-card md:border md:border-brand-gray-300/60 md:bg-white md:shadow-card">
        <table className="block w-full text-left text-sm md:table md:min-w-[760px]">
          <thead className="hidden bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500 md:table-header-group">
            <tr>
              <th className="w-10 px-5 py-3">
                <SelecionarTodosCheckbox ids={despesasPagina.map((d) => d.id)} />
              </th>
              <th className="px-5 py-3 font-extrabold">Data</th>
              <th className="px-5 py-3 font-extrabold">Lançamento</th>
              <th className="px-5 py-3 text-right font-extrabold">Valor</th>
              <th className="px-5 py-3 font-extrabold">Comprovante</th>
              <th className="px-5 py-3 text-right font-extrabold">Ações</th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group md:divide-y md:divide-brand-gray-300/40">
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
              const notaCompleta = notasCompletas.get(d.id);

              return (
                <Fragment key={d.id}>
                {grupoNota && grupoNota.indice === 1 && notaCompleta && (
                  <tr
                    className="block md:table-row"
                    style={{ background: `${grupoNota.cor}0f` }}
                  >
                    <td
                      colSpan={6}
                      className="block border-b-2 px-4 py-3 md:table-cell md:px-5"
                      style={{ borderColor: grupoNota.cor }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                        <p className="flex items-center gap-1.5 text-xs font-extrabold text-brand-black">
                          <span style={{ color: grupoNota.cor }}>🧾</span>
                          Nota com {notaCompleta.membros.length} itens
                          {fornecedorNome !== "-" ? ` · ${fornecedorNome}` : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {notaCompleta.valorDesconto != null && (
                            <span className="text-brand-gray-400 line-through">
                              {formatBRL(notaCompleta.valorItensOriginal ?? 0)}
                            </span>
                          )}
                          {notaCompleta.valorDesconto != null && notaCompleta.valorDesconto > 0 && (
                            <span
                              className="inline-flex w-fit items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 font-extrabold text-status-success"
                              title={`Os itens continuam com o preço de tabela. Este total já é o que foi de fato pago, descontando ${formatBRL(notaCompleta.valorDesconto)}.`}
                            >
                              📉 -{formatBRL(notaCompleta.valorDesconto)}
                            </span>
                          )}
                          {notaCompleta.valorDesconto != null && notaCompleta.valorDesconto < 0 && (
                            <span
                              className="inline-flex w-fit items-center gap-1 rounded-full bg-status-warning/10 px-2 py-0.5 font-extrabold text-status-warning"
                              title={`Os itens continuam com o preço de tabela. Este total já inclui ${formatBRL(Math.abs(notaCompleta.valorDesconto))} de frete/acréscimo não itemizado.`}
                            >
                              📈 +{formatBRL(Math.abs(notaCompleta.valorDesconto))}
                            </span>
                          )}
                          <span className="font-extrabold text-brand-black">
                            {formatBRL(notaCompleta.total)} pago
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  className="relative mb-3 flex flex-wrap items-start gap-y-2 rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card last:mb-0 md:mb-0 md:table-row md:flex-none md:gap-0 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:align-top md:hover:bg-brand-gray-100/60"
                  style={grupoNota ? { borderLeft: `4px solid ${grupoNota.cor}` } : undefined}
                >
                  <td className="absolute right-4 top-4 z-10 md:static md:table-cell md:w-10 md:px-5 md:py-4">
                    <DespesaCheckbox id={d.id} />
                  </td>
                  <td
                    className="order-2 block w-1/2 whitespace-nowrap pr-2 text-xs font-bold text-brand-gray-500 md:table-cell md:w-auto md:px-5 md:py-4 md:text-sm md:font-semibold md:text-brand-black md:[box-shadow:inset_4px_0_0_0_var(--grupo-cor)]"
                    style={grupoNota ? ({ "--grupo-cor": grupoNota.cor } as React.CSSProperties) : undefined}
                  >
                    {formatDataBR(d.data)}
                  </td>
                  <td className="order-1 block w-full pb-3 pr-10 md:table-cell md:w-auto md:px-5 md:py-4 md:pr-5">
                    <OpenDespesaModalButton despesaId={d.id}>
                      <div className="flex items-start gap-3">
                        <IconeNome nomes={[materialNome, d.descricao, categoriaNome]} gerarPara={categoriaNome} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="font-semibold text-brand-black">{obraNome}</p>
                            <span className="inline-flex w-fit rounded-full bg-brand-red/10 px-2 py-0.5 text-[10px] font-bold text-brand-red">
                              {categoriaNome}
                            </span>
                            {etapaNome !== "-" && (
                              <span className="text-[11px] text-brand-gray-500">{etapaNome}</span>
                            )}
                          </div>
                          <p className="mt-1 break-words text-xs text-brand-gray-500 md:max-w-[340px] md:truncate">
                            {d.descricao ?? "Sem descrição"}
                          </p>
                          {(materialNome !== "-" || fornecedorNome !== "-") && (
                            <p className="mt-1 break-words text-[11px] text-brand-gray-400 md:max-w-[340px] md:truncate">
                              {[materialNome, fornecedorNome].filter((v) => v !== "-").join(" · ")}
                            </p>
                          )}
                          {d.quantidade != null && (
                            <p className="mt-1 text-[11px] font-semibold text-brand-gray-600">
                              {valorInputBR(d.quantidade)}
                              {d.valor_unitario != null ? ` × ${formatBRL(d.valor_unitario)}` : ""}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex w-fit rounded-full bg-status-info/10 px-2 py-0.5 text-[10px] font-bold text-status-info">
                              {contaBancariaInfo.contas_bancarias?.nome ?? "Sem conta"}
                            </span>
                            <span
                              className={
                                d.criado_por_telefone?.startsWith("tg_")
                                  ? "inline-flex w-fit rounded-full bg-status-info/10 px-2 py-0.5 text-[10px] font-bold text-status-info"
                                  : d.origem === "whatsapp"
                                    ? "inline-flex w-fit rounded-full bg-[#e9f8f0] px-2 py-0.5 text-[10px] font-bold text-status-success"
                                    : "inline-flex w-fit rounded-full bg-brand-gray-100 px-2 py-0.5 text-[10px] font-bold text-brand-gray-700"
                              }
                            >
                              {rotuloOrigem(d.origem, d.criado_por_telefone)}
                            </span>
                            {grupoNota && (
                              <span
                                className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                                style={{ background: `${grupoNota.cor}1a`, color: grupoNota.cor }}
                                title="Item desta nota"
                              >
                                🧾 {grupoNota.indice}/{notaCompleta?.membros.length ?? grupoNota.total}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </OpenDespesaModalButton>
                  </td>
                  <td className="order-2 block w-1/2 text-right md:table-cell md:w-auto md:px-5 md:py-4">
                    <p className="font-display text-base font-bold text-brand-black md:text-lg">
                      {formatBRL(d.valor)}
                    </p>
                  </td>
                  <td className="order-3 block w-full pt-1 md:table-cell md:w-auto md:px-5 md:py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {documentosCobranca[0]?.url ? (
                        <Link
                          href={documentosCobranca[0].url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Ver conta ou nota"
                          title="Ver conta ou nota"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-brand-sm border border-status-info/25 bg-white px-2.5 py-2 text-[11px] font-bold text-status-info hover:bg-status-info hover:text-white"
                        >
                          <ActionIcon name="file" />
                          Nota
                        </Link>
                      ) : (
                        <span
                          aria-label="Sem conta ou nota"
                          title="Sem conta ou nota"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-brand-sm border border-brand-gray-300 bg-brand-gray-100 px-2.5 py-2 text-[11px] font-bold text-brand-gray-500"
                        >
                          <ActionIcon name="file" />
                          Nota
                        </span>
                      )}
                      {comprovantesPagamento[0]?.url ? (
                        <Link
                          href={comprovantesPagamento[0].url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Ver comprovante de pagamento"
                          title={
                            notaCompleta
                              ? `Comprovante do pagamento da nota inteira: ${formatBRL(notaCompleta.total)} (${notaCompleta.membros.length} itens). É o mesmo comprovante em todos os itens.`
                              : "Ver comprovante de pagamento"
                          }
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-brand-sm border border-status-success/25 bg-[#e9f8f0] px-2.5 py-2 text-[11px] font-bold text-status-success hover:bg-status-success hover:text-white"
                        >
                          <ActionIcon name="payment" />
                          {notaCompleta ? "Pago · nota toda" : "Pago"}
                        </Link>
                      ) : (
                        <span
                          aria-label="Comprovante de pagamento pendente"
                          title="Comprovante de pagamento pendente"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-brand-sm border border-status-warning/25 bg-status-warning/10 px-2.5 py-2 text-[11px] font-bold text-status-warning"
                        >
                          <ActionIcon name="payment" />
                          Pendente
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="order-4 block w-full border-t border-brand-gray-300/60 pt-3 text-right md:table-cell md:w-auto md:border-0 md:px-5 md:py-4">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <CadastroModal
                        titulo="Editar lançamento"
                        descricao="Confira e corrija os dados, os documentos e a classificação."
                        botao="Editar"
                        icone={<ActionIcon name="edit" />}
                        variante="icone"
                        triggerId={`despesa-${d.id}`}
                      >
                        <FormularioEdicao
                          despesa={{
                            id: d.id,
                            obra_id: d.obra_id,
                            categoria_id: d.categoria_id,
                            etapa_id: d.etapa_id,
                            material_id: d.material_id,
                            fornecedor_id: d.fornecedor_id,
                            conta_bancaria_id: contaBancariaInfo.conta_bancaria_id,
                            valor: d.valor,
                            quantidade: d.quantidade,
                            valor_unitario: d.valor_unitario,
                            data: d.data,
                            descricao: d.descricao,
                            origem: d.origem,
                            criado_por_nome: d.criado_por_nome,
                            criado_por_telefone: d.criado_por_telefone,
                            created_at: d.created_at,
                          }}
                          nomes={{
                            obra: obraNome,
                            categoria: categoriaNome,
                            etapa: etapaNome,
                            material: materialNome,
                            fornecedor: fornecedorNome,
                            conta: contaBancariaInfo.contas_bancarias?.nome ?? "Sem conta",
                          }}
                          obras={obras ?? []}
                          categorias={categorias ?? []}
                          etapas={etapasDaDespesa}
                          materiais={materiais ?? []}
                          fornecedores={fornecedores ?? []}
                          contas={contasBancarias ?? []}
                          comprovantes={comprovantesDaDespesa}
                          fornecedorDados={fornecedorDados}
                          nota={
                            grupoNota && notaCompleta
                              ? {
                                  posicao: grupoNota.indice,
                                  totalItens: notaCompleta.membros.length,
                                  cor: grupoNota.cor,
                                  totalPago: notaCompleta.total,
                                  valorDesconto: notaCompleta.valorDesconto,
                                }
                              : null
                          }
                        />
                      </CadastroModal>
                      <DeleteButton despesaId={d.id} action={deleteDespesaAction} />
                    </div>
                  </td>
                </tr>
                </Fragment>
              );
            })}

            {despesas.length === 0 && (
              <tr className="block md:table-row">
                <td colSpan={11} className="block px-5 py-10 text-center text-sm text-brand-gray-500 md:table-cell">
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
      <SelecaoActionBar />
    </div>
    </SelecaoLancamentosProvider>
  );
}
