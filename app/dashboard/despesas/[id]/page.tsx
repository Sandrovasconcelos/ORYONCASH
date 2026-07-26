import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateDespesaAction } from "../../actions";

export default async function EditarDespesaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: despesa } = await supabase
    .from("despesas")
    .select(
      "id, obra_id, categoria_id, etapa_id, fornecedor_id, descricao, valor, data"
    )
    .eq("id", id)
    .maybeSingle();

  if (!despesa) notFound();

  const [{ data: obras }, { data: categorias }, { data: fornecedores }, { data: etapasProprias }] =
    await Promise.all([
      supabase.from("obras").select("id, nome").order("nome"),
      supabase.from("categorias").select("id, nome").order("nome"),
      supabase.from("fornecedores").select("id, nome").order("nome"),
      supabase
        .from("etapas")
        .select("id, nome")
        .eq("obra_id", despesa.obra_id)
        .order("ordem"),
    ]);

  let etapas = etapasProprias ?? [];
  if (etapas.length === 0) {
    const { data: etapasGenericas } = await supabase
      .from("etapas")
      .select("id, nome")
      .is("obra_id", null)
      .order("ordem");
    etapas = etapasGenericas ?? [];
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        action={updateDespesaAction}
        className="max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={despesa.id} />

        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Editar Despesa
        </p>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Obra
          <select
            name="obra_id"
            defaultValue={despesa.obra_id}
            required
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {(obras ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Categoria
          <select
            name="categoria_id"
            defaultValue={despesa.categoria_id}
            required
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {(categorias ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Etapa
          <select
            name="etapa_id"
            defaultValue={despesa.etapa_id ?? ""}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">—</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">
            Se você mudar a obra acima, salve e reabra a edição para ver as
            etapas da nova obra.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Fornecedor
          <select
            name="fornecedor_id"
            defaultValue={despesa.fornecedor_id ?? ""}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">—</option>
            {(fornecedores ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Valor
          <input
            name="valor"
            defaultValue={despesa.valor}
            required
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Data
          <input
            type="date"
            name="data"
            defaultValue={despesa.data}
            required
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Descrição
          <textarea
            name="descricao"
            defaultValue={despesa.descricao ?? ""}
            rows={3}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Salvar
        </button>
      </form>
    </div>
  );
}
