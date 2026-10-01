import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMaterialAction, deleteMaterialAction, updateMaterialAction } from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";
import { SubmitButton } from "../submit-button";
import { PrecoUnitarioChart } from "../charts/preco-unitario-chart";
import { formatBRL } from "@/lib/conversation/format";

export const dynamic = "force-dynamic";

function formatDataCurta(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function inferirTipo(nome: string) {
  const normalizado = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizado.includes("cabo")) return "Cabo";
  if (normalizado.includes("cano") || normalizado.includes("tubo")) return "Cano / Tubo";
  if (normalizado.includes("cimento") || normalizado.includes("argamassa")) return "Cimento";
  if (normalizado.includes("fio")) return "Fio";
  if (normalizado.includes("areia") || normalizado.includes("brita")) return "Agregado";
  return "Material";
}

export default async function MateriaisPage() {
  const supabase = createAdminClient();
  const [{ data: materiais }, { data: categorias }, { data: despesas }, { data: despesasComPreco }] =
    await Promise.all([
      supabase
        .from("materiais")
        .select("id, nome, categoria_id, created_at, categorias(nome)")
        .is("deleted_at", null)
        .order("nome"),
      supabase.from("categorias").select("id, nome").is("deleted_at", null).order("nome"),
      supabase.from("despesas").select("material_id, valor").is("deleted_at", null),
      supabase
        .from("despesas")
        .select("material_id, data, valor_unitario, quantidade, fornecedores(nome)")
        .is("deleted_at", null)
        .not("material_id", "is", null)
        .not("valor_unitario", "is", null)
        .order("data", { ascending: true }),
    ]);

  const lista = materiais ?? [];
  const usoPorMaterial = new Map<string, number>();
  const tipos = new Map<string, number>();

  for (const material of lista) {
    const tipo = inferirTipo(material.nome);
    tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1);
  }

  for (const despesa of despesas ?? []) {
    if (!despesa.material_id) continue;
    usoPorMaterial.set(despesa.material_id, (usoPorMaterial.get(despesa.material_id) ?? 0) + 1);
  }

  const precosPorMaterial = new Map<
    string,
    { data: string; valorUnitario: number; quantidade: number | null; fornecedorNome: string }[]
  >();
  for (const d of despesasComPreco ?? []) {
    if (!d.material_id || d.valor_unitario == null) continue;
    const listaPrecos = precosPorMaterial.get(d.material_id) ?? [];
    listaPrecos.push({
      data: d.data,
      valorUnitario: Number(d.valor_unitario),
      quantidade: d.quantidade,
      fornecedorNome: (d.fornecedores as unknown as { nome: string } | null)?.nome ?? "-",
    });
    precosPorMaterial.set(d.material_id, listaPrecos);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-black">Materiais</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Visualize, cadastre e edite o catálogo usado nos lançamentos.
          </p>
        </div>
        <CadastroModal
          titulo="Novo material"
          descricao="Ex: Cabo elétrico 2,5mm, Cano PVC água fria 50mm."
          botao="+ Cadastrar material"
          variante="primario"
        >
          <form action={createMaterialAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Nome
              <input
                name="nome"
                required
                placeholder="Ex: Cabo elétrico 2,5mm"
                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Categoria
              <select
                name="categoria_id"
                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
              >
                <option value="">Sem categoria</option>
                {(categorias ?? []).map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700">
              Salvar material
            </SubmitButton>
            <Link
              href="/dashboard/categorias"
              className="text-center text-xs font-semibold text-brand-red hover:underline"
            >
              Criar ou revisar categorias
            </Link>
          </form>
        </CadastroModal>
      </div>

      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ResumoCard label="Materiais" valor={String(lista.length)} />
          <ResumoCard label="Tipos detectados" valor={String(tipos.size)} />
          <ResumoCard
            label="Mais comum"
            valor={[...tipos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-"}
          />
        </div>

        <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
          <div className="border-b border-brand-gray-300/60 px-5 py-4">
            <p className="text-sm font-semibold text-brand-black">Tabela de materiais</p>
            <p className="mt-1 text-xs text-brand-gray-500">
              Padronize nomes com tipo, medida, bitola e descrição para o WhatsApp sugerir melhor.
            </p>
          </div>

          <div className="md:overflow-x-auto">
            <table className="block w-full text-left text-sm md:table md:min-w-[900px]">
              <thead className="hidden bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500 md:table-header-group">
                <tr>
                  <th className="px-5 py-3 font-extrabold">Tipo</th>
                  <th className="px-5 py-3 font-extrabold">Material</th>
                  <th className="px-5 py-3 font-extrabold">Categoria</th>
                  <th className="px-5 py-3 font-extrabold">Uso</th>
                  <th className="px-5 py-3 font-extrabold">Criado em</th>
                  <th className="px-5 py-3 text-right font-extrabold">Ação</th>
                </tr>
              </thead>
              <tbody className="block divide-y-0 md:table-row-group md:divide-y md:divide-brand-gray-300/40">
                {lista.map((material) => (
                  <tr
                    key={material.id}
                    className="mb-3 block rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card last:mb-0 md:mb-0 md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:align-middle md:hover:bg-brand-gray-100/55"
                  >
                    <td className="mb-2 block w-full md:mb-0 md:table-cell md:px-5 md:py-4">
                      <span className="inline-flex rounded-full bg-brand-red/10 px-3 py-1 text-xs font-bold text-brand-red">
                        {inferirTipo(material.nome)}
                      </span>
                    </td>
                    <td className="mb-2 block w-full md:mb-0 md:table-cell md:px-5 md:py-4">
                      <Link
                        href={`/dashboard/despesas?material=${material.id}`}
                        className="font-semibold text-brand-black hover:text-brand-red hover:underline"
                        title="Ver lançamentos deste material"
                      >
                        {material.nome}
                      </Link>
                    </td>
                    <td className="mb-2 block w-full md:mb-0 md:table-cell md:px-5 md:py-4">
                      <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand-gray-400 md:hidden">
                        Categoria:
                      </span>
                      <span className="text-brand-gray-700">
                        {(material.categorias as unknown as { nome: string } | null)?.nome ??
                          "Sem categoria"}
                      </span>
                    </td>
                    <td className="mb-2 block w-full md:mb-0 md:table-cell md:px-5 md:py-4">
                      <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand-gray-400 md:hidden">
                        Uso:
                      </span>
                      <Badge>{usoPorMaterial.get(material.id) ?? 0}</Badge>
                    </td>
                    <td className="mb-3 block w-full text-xs text-brand-gray-500 md:mb-0 md:table-cell md:px-5 md:py-4 md:text-sm">
                      <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand-gray-400 md:hidden">
                        Criado em:
                      </span>
                      {new Date(material.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  <td className="block w-full border-t border-brand-gray-300/60 pt-3 text-right md:table-cell md:border-0 md:px-5 md:py-4">
                      <div className="flex items-center justify-end gap-2">
                        {(() => {
                          const precos = precosPorMaterial.get(material.id) ?? [];
                          if (precos.length === 0) return null;
                          const valores = precos.map((p) => p.valorUnitario);
                          const minimo = Math.min(...valores);
                          const maximo = Math.max(...valores);
                          const media = valores.reduce((s, v) => s + v, 0) / valores.length;
                          const ultimo = precos[precos.length - 1];
                          return (
                            <CadastroModal
                              titulo={`Histórico de preço — ${material.nome}`}
                              descricao="Evolução do valor unitário nos lançamentos com nota fiscal."
                              botao="Preço"
                              icone={<ActionIcon name="calculator" />}
                              variante="icone"
                              modalSize="wide"
                            >
                              <div className="flex flex-col gap-5">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                  <ResumoCard label="Mínimo" valor={formatBRL(minimo)} />
                                  <ResumoCard label="Máximo" valor={formatBRL(maximo)} />
                                  <ResumoCard label="Média" valor={formatBRL(media)} />
                                  <ResumoCard label="Último" valor={formatBRL(ultimo.valorUnitario)} />
                                </div>
                                <PrecoUnitarioChart
                                  pontos={precos.map((p) => ({
                                    data: formatDataCurta(p.data),
                                    valorUnitario: p.valorUnitario,
                                    fornecedorNome: p.fornecedorNome,
                                  }))}
                                />
                                <div className="flex flex-col gap-2 sm:overflow-x-auto sm:rounded-card sm:border sm:border-brand-gray-300/70 sm:gap-0">
                                  <table className="block w-full text-left text-sm sm:table sm:min-w-[480px]">
                                    <thead className="hidden bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500 sm:table-header-group">
                                      <tr>
                                        <th className="px-4 py-2 font-extrabold">Data</th>
                                        <th className="px-4 py-2 font-extrabold">Fornecedor</th>
                                        <th className="px-4 py-2 text-right font-extrabold">Qtd</th>
                                        <th className="px-4 py-2 text-right font-extrabold">Valor unitário</th>
                                      </tr>
                                    </thead>
                                    <tbody className="block divide-y-0 sm:table-row-group sm:divide-y sm:divide-brand-gray-300/40">
                                      {[...precos].reverse().map((p, indice) => (
                                        <tr
                                          key={indice}
                                          className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-brand-sm border border-brand-gray-300/60 px-3 py-2 last:mb-0 sm:mb-0 sm:table-row sm:flex-none sm:rounded-none sm:border-0 sm:px-0 sm:py-0"
                                        >
                                          <td className="order-1 block text-brand-gray-700 sm:table-cell sm:px-4 sm:py-2">
                                            {formatDataCurta(p.data)}
                                          </td>
                                          <td className="order-3 block w-full text-xs text-brand-gray-500 sm:order-none sm:w-auto sm:table-cell sm:px-4 sm:py-2 sm:text-sm sm:text-brand-gray-700">
                                            {p.fornecedorNome}
                                          </td>
                                          <td className="order-2 block text-right text-brand-gray-700 sm:table-cell sm:px-4 sm:py-2">
                                            {p.quantidade ?? "-"}
                                          </td>
                                          <td className="order-2 block text-right font-semibold text-brand-black sm:table-cell sm:px-4 sm:py-2">
                                            {formatBRL(p.valorUnitario)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </CadastroModal>
                          );
                        })()}
                        <CadastroModal
                          titulo="Editar material"
                          descricao="Padronize nome e categoria para melhorar a seleção no WhatsApp."
                          botao="Editar"
                          icone={<ActionIcon name="edit" />}
                          variante="icone"
                        >
                          <form action={updateMaterialAction} className="flex flex-col gap-4">
                            <input type="hidden" name="id" value={material.id} />
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Nome
                              <input
                                name="nome"
                                defaultValue={material.nome}
                                required
                                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Categoria
                              <select
                                name="categoria_id"
                                defaultValue={material.categoria_id ?? ""}
                                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                              >
                                <option value="">Sem categoria</option>
                                {(categorias ?? []).map((categoria) => (
                                  <option key={categoria.id} value={categoria.id}>
                                    {categoria.nome}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <SubmitButton className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700">
                              Salvar edição
                            </SubmitButton>
                          </form>
                        </CadastroModal>
                        <DeleteCadastroButton
                          id={material.id}
                          nome={material.nome}
                          entidade="Material"
                          usadoEm={usoPorMaterial.get(material.id) ?? 0}
                          detalhesUso={`${usoPorMaterial.get(material.id) ?? 0} lançamento(s) vinculados.`}
                          action={deleteMaterialAction}
                        />
                      </div>
                    </td>
                  </tr>
                ))}

                {lista.length === 0 && (
                  <tr className="block md:table-row">
                    <td colSpan={6} className="block px-5 py-10 text-center text-brand-gray-500 md:table-cell">
                      Nenhum material cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-10 justify-center rounded-full bg-brand-gray-100 px-3 py-1 text-xs font-bold text-brand-gray-700">
      {children}
    </span>
  );
}

function ResumoCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold text-brand-gray-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-brand-black">{valor}</p>
    </div>
  );
}
