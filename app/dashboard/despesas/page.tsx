import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/conversation/format";
import { deleteDespesaAction } from "../actions";
import { DeleteButton } from "./delete-button";

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: obras }, despesasQuery] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    (async () => {
      let query = supabase
        .from("despesas")
        .select(
          "id, valor, descricao, data, origem, obras(nome), categorias(nome), etapas(nome), fornecedores(nome)"
        )
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (params.obra) query = query.eq("obra_id", params.obra);
      return query;
    })(),
  ]);

  const despesas = despesasQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Filtrar por obra:
        </p>
        <form className="flex items-center gap-2">
          <select
            name="obra"
            defaultValue={params.obra ?? ""}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Todas as obras</option>
            {(obras ?? []).map((obra) => (
              <option key={obra.id} value={obra.id}>
                {obra.nome}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Filtrar
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Obra</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Etapa</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Fornecedor</th>
              <th className="px-4 py-3 font-medium text-right">Valor</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {despesas.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                  {(d.obras as unknown as { nome: string } | null)?.nome ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {(d.categorias as unknown as { nome: string } | null)?.nome ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {(d.etapas as unknown as { nome: string } | null)?.nome ?? "—"}
                </td>
                <td className="px-4 py-3 max-w-[220px] truncate text-zinc-700 dark:text-zinc-300">
                  {d.descricao ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {(d.fornecedores as unknown as { nome: string } | null)?.nome ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                  {formatBRL(d.valor)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs capitalize text-zinc-600 dark:text-zinc-300">
                    {d.origem}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <Link
                      href={`/dashboard/despesas/${d.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Editar
                    </Link>
                    <DeleteButton despesaId={d.id} action={deleteDespesaAction} />
                  </div>
                </td>
              </tr>
            ))}
            {despesas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  Nenhuma despesa registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
