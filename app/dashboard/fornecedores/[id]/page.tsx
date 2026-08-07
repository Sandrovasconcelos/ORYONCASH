import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateFornecedorAction } from "../../actions";
import { SubmitButton } from "../../submit-button";

export default async function EditarFornecedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const completo = await supabase
    .from("fornecedores")
    .select("id, nome, contato, cnpj, cpf, chave_pix, conta_banco, conta_agencia, conta_numero")
    .eq("id", id)
    .maybeSingle();

  const fornecedor = completo.error
    ? await supabase
        .from("fornecedores")
        .select("id, nome, contato, cnpj")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) =>
          data
            ? {
                ...data,
                cpf: null,
                chave_pix: null,
                conta_banco: null,
                conta_agencia: null,
                conta_numero: null,
              }
            : null
        )
    : completo.data;

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
            CNPJ
            <input
              name="cnpj"
              defaultValue={fornecedor.cnpj ?? ""}
              placeholder="00.000.000/0000-00"
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
            CPF
            <input
              name="cpf"
              defaultValue={fornecedor.cpf ?? ""}
              placeholder="000.000.000-00"
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
          Chave Pix
          <input
            name="chave_pix"
            defaultValue={fornecedor.chave_pix ?? ""}
            placeholder="Telefone, e-mail, CPF/CNPJ ou chave aleatória"
            className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
            Banco
            <input
              name="conta_banco"
              defaultValue={fornecedor.conta_banco ?? ""}
              placeholder="Ex: Nubank"
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
            Agência
            <input
              name="conta_agencia"
              defaultValue={fornecedor.conta_agencia ?? ""}
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
            Conta
            <input
              name="conta_numero"
              defaultValue={fornecedor.conta_numero ?? ""}
              className="rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red"
            />
          </label>
        </div>

        <SubmitButton className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-700">
          Salvar
        </SubmitButton>
      </form>
    </div>
  );
}
