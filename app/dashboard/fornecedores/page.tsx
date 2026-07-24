import { createClient } from "@/lib/supabase/server";
import { createFornecedorAction } from "../actions";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const { data: fornecedores } = await supabase
    .from("fornecedores")
    .select("id, nome, contato")
    .order("nome");

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(fornecedores ?? []).map((fornecedor) => (
              <tr key={fornecedor.id}>
                <td className="px-5 py-3 text-zinc-900 dark:text-zinc-100">
                  {fornecedor.nome}
                </td>
                <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                  {fornecedor.contato ?? "—"}
                </td>
              </tr>
            ))}
            {(fornecedores ?? []).length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-6 text-center text-zinc-500">
                  Nenhum fornecedor cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        action={createFornecedorAction}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex flex-col gap-4 max-w-md"
      >
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Novo Fornecedor
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
          Contato
          <input
            name="contato"
            placeholder="Telefone ou observação"
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
