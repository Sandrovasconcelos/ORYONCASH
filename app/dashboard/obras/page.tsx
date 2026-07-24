import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/conversation/format";
import { createObraAction } from "../actions";

export default async function ObrasPage() {
  const supabase = await createClient();
  const [{ data: obras }, { data: despesas }] = await Promise.all([
    supabase
      .from("obras")
      .select("id, nome, orcamento_total, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("despesas").select("obra_id, valor"),
  ]);

  const gastoPorObra = new Map<string, number>();
  for (const d of despesas ?? []) {
    gastoPorObra.set(d.obra_id, (gastoPorObra.get(d.obra_id) ?? 0) + d.valor);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Orçamento</th>
              <th className="px-5 py-3 font-medium">Gasto</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(obras ?? []).map((obra) => (
              <tr key={obra.id}>
                <td className="px-5 py-3 text-zinc-900 dark:text-zinc-100">
                  {obra.nome}
                </td>
                <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                  {formatBRL(obra.orcamento_total)}
                </td>
                <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                  {formatBRL(gastoPorObra.get(obra.id) ?? 0)}
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs capitalize text-zinc-600 dark:text-zinc-300">
                    {obra.status}
                  </span>
                </td>
              </tr>
            ))}
            {(obras ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-zinc-500">
                  Nenhuma obra cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        action={createObraAction}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex flex-col gap-4 max-w-md"
      >
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Nova Obra
        </p>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nome
          <input
            name="nome"
            required
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Orçamento Total
          <input
            name="orcamento"
            placeholder="Ex: 500000,00"
            required
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
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
