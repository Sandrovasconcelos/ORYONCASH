import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMaterialAction, deleteMaterialAction, updateMaterialAction } from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";

export const dynamic = "force-dynamic";

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
  const [{ data: materiais }, { data: categorias }, { data: despesas }] = await Promise.all([
    supabase
      .from("materiais")
      .select("id, nome, categoria_id, created_at, categorias(nome)")
      .is("deleted_at", null)
      .order("nome"),
    supabase.from("categorias").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("despesas").select("material_id, valor").is("deleted_at", null),
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
            <button
              type="submit"
              className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700"
            >
              Salvar material
            </button>
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500">
                <tr>
                  <th className="px-5 py-3 font-extrabold">Tipo</th>
                  <th className="px-5 py-3 font-extrabold">Material</th>
                  <th className="px-5 py-3 font-extrabold">Categoria</th>
                  <th className="px-5 py-3 font-extrabold">Uso</th>
                  <th className="px-5 py-3 font-extrabold">Criado em</th>
                  <th className="px-5 py-3 text-right font-extrabold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-gray-300/40">
                {lista.map((material) => (
                  <tr key={material.id} className="align-middle hover:bg-brand-gray-100/55">
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-brand-red/10 px-3 py-1 text-xs font-bold text-brand-red">
                        {inferirTipo(material.nome)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-brand-black">{material.nome}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-brand-gray-700">
                        {(material.categorias as unknown as { nome: string } | null)?.nome ??
                          "Sem categoria"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge>{usoPorMaterial.get(material.id) ?? 0}</Badge>
                    </td>
                    <td className="px-5 py-4 text-brand-gray-500">
                      {new Date(material.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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
                            <button
                              type="submit"
                              className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700"
                            >
                              Salvar edição
                            </button>
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
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-brand-gray-500">
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
