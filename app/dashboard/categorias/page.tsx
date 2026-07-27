import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCategoriaAction,
  deleteCategoriaAction,
  updateCategoriaAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const supabase = createAdminClient();
  const [{ data: categorias }, { data: despesas }, { data: materiais }] =
    await Promise.all([
      supabase
        .from("categorias")
        .select("id, nome, created_at")
        .is("deleted_at", null)
        .order("nome"),
      supabase.from("despesas").select("categoria_id, valor").is("deleted_at", null),
      supabase.from("materiais").select("categoria_id").is("deleted_at", null),
    ]);

  const lista = categorias ?? [];
  const totalPorCategoria = new Map<string, number>();
  const lancamentosPorCategoria = new Map<string, number>();
  const materiaisPorCategoria = new Map<string, number>();

  for (const despesa of despesas ?? []) {
    totalPorCategoria.set(
      despesa.categoria_id,
      (totalPorCategoria.get(despesa.categoria_id) ?? 0) + Number(despesa.valor ?? 0)
    );
    lancamentosPorCategoria.set(
      despesa.categoria_id,
      (lancamentosPorCategoria.get(despesa.categoria_id) ?? 0) + 1
    );
  }

  for (const material of materiais ?? []) {
    if (!material.categoria_id) continue;
    materiaisPorCategoria.set(
      material.categoria_id,
      (materiaisPorCategoria.get(material.categoria_id) ?? 0) + 1
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-black">Categorias</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Visualize, cadastre e edite as categorias usadas no WhatsApp.
          </p>
        </div>
        <CadastroModal
          titulo="Nova categoria"
          descricao="Ex: Material, Mão de obra, Equipamentos, Transporte, Projeto."
          botao="+ Cadastrar categoria"
          variante="primario"
        >
          <form action={createCategoriaAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Nome
              <input
                name="nome"
                required
                placeholder="Ex: Material"
                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
              />
            </label>
            <button
              type="submit"
              className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700"
            >
              Salvar categoria
            </button>
          </form>
        </CadastroModal>
      </div>

      <section className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="border-b border-brand-gray-300/60 px-5 py-4">
          <p className="text-sm font-semibold text-brand-black">Tabela de categorias</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Categorias aparecem no WhatsApp, filtros, edição de lançamentos e relatórios.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500">
              <tr>
                <th className="px-5 py-3 font-extrabold">Categoria</th>
                <th className="px-5 py-3 font-extrabold">Materiais</th>
                <th className="px-5 py-3 font-extrabold">Lançamentos</th>
                <th className="px-5 py-3 font-extrabold">Criada em</th>
                <th className="px-5 py-3 text-right font-extrabold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-gray-300/40">
              {lista.map((categoria) => (
                <tr key={categoria.id} className="align-middle hover:bg-brand-gray-100/55">
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/despesas?categoria=${categoria.id}`}
                      className="font-semibold text-brand-black hover:text-brand-red hover:underline"
                      title="Ver lançamentos desta categoria"
                    >
                      {categoria.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Badge>{materiaisPorCategoria.get(categoria.id) ?? 0}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge>{lancamentosPorCategoria.get(categoria.id) ?? 0}</Badge>
                  </td>
                  <td className="px-5 py-4 text-brand-gray-500">
                    {new Date(categoria.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <CadastroModal
                        titulo="Editar categoria"
                        descricao="Essa alteração muda a categoria nos filtros, WhatsApp e relatórios."
                        botao="Editar"
                        icone={<ActionIcon name="edit" />}
                        variante="icone"
                      >
                        <form action={updateCategoriaAction} className="flex flex-col gap-4">
                          <input type="hidden" name="id" value={categoria.id} />
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Nome
                            <input
                              name="nome"
                              defaultValue={categoria.nome}
                              required
                              className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                            />
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
                        id={categoria.id}
                        nome={categoria.nome}
                        entidade="Categoria"
                        usadoEm={
                          (lancamentosPorCategoria.get(categoria.id) ?? 0) +
                          (materiaisPorCategoria.get(categoria.id) ?? 0)
                        }
                        detalhesUso={`${lancamentosPorCategoria.get(categoria.id) ?? 0} lançamento(s) e ${materiaisPorCategoria.get(categoria.id) ?? 0} material(is) vinculados.`}
                        action={deleteCategoriaAction}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              {lista.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-brand-gray-500">
                    Nenhuma categoria cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
