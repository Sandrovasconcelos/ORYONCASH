import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateFornecedorAction } from "../../actions";

export default async function EditarFornecedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: fornecedor } = await supabase
    .from("fornecedores")
    .select("id, nome, contato, cnpj")
    .eq("id", id)
    .maybeSingle();

  if (!fornecedor) notFound();

  return (
    <div className="flex flex-col gap-6">
      <form
        action={updateFornecedorAction}
        className="max-w-xl rounded-card border border-brand-gray-300/60 bg-white shadow-card p-6 flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={fornecedor.id} />

        <p className="text-lg font-semibold text-brand-black">
          Editar Fornecedor
        </p>

        <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
          Nome
          <input
            name="nome"
            defaultValue={fornecedor.nome}
            required
            className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
          Contato
          <input
            name="contato"
            defaultValue={fornecedor.contato ?? ""}
            placeholder="Telefone ou observação"
            className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
          CNPJ / CPF
          <input
            name="cnpj"
            defaultValue={fornecedor.cnpj ?? ""}
            placeholder="00.000.000/0000-00"
            className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
          />
        </label>

        <button
          type="submit"
          className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-700"
        >
          Salvar
        </button>
      </form>
    </div>
  );
}
