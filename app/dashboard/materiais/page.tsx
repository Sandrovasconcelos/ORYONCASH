import { createClient } from "@/lib/supabase/server";
import { createMaterialAction } from "../actions";

export default async function MateriaisPage() {
  const supabase = await createClient();
  const [{ data: materiais }, { data: categorias }] = await Promise.all([
    supabase
      .from("materiais")
      .select("id, nome, categoria_id, categorias(nome)")
      .order("nome"),
    supabase.from("categorias").select("id, nome").order("nome"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Categoria</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(materiais ?? []).map((material) => (
              <tr key={material.id}>
                <td className="px-5 py-3 text-zinc-900 dark:text-zinc-100">
                  {material.nome}
                </td>
                <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                  {(material.categorias as unknown as { nome: string } | null)
                    ?.nome ?? "—"}
                </td>
              </tr>
            ))}
            {(materiais ?? []).length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-6 text-center text-zinc-500">
                  Nenhum material cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        action={createMaterialAction}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex flex-col gap-4 max-w-md"
      >
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Novo Material
        </p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nome
          <input
            name="nome"
            required
            placeholder="Ex: Cimento CP-II 50kg"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Categoria
          <select
            name="categoria_id"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {(categorias ?? []).map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Cadastrar
        </button>
      </form>
    </div>
  );
}
