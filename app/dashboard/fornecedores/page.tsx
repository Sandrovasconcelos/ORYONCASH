import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createFornecedorAction,
  deleteFornecedorAction,
  updateFornecedorModalAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const supabase = createAdminClient();
  const [{ data: fornecedores }, { data: despesas }] = await Promise.all([
    supabase
      .from("fornecedores")
      .select("id, nome, contato, cnpj, created_at")
      .is("deleted_at", null)
      .order("nome"),
    supabase.from("despesas").select("fornecedor_id, valor").is("deleted_at", null),
  ]);

  const lista = fornecedores ?? [];
  const usoPorFornecedor = new Map<string, { total: number; lancamentos: number }>();

  for (const despesa of despesas ?? []) {
    if (!despesa.fornecedor_id) continue;
    const atual = usoPorFornecedor.get(despesa.fornecedor_id) ?? { total: 0, lancamentos: 0 };
    usoPorFornecedor.set(despesa.fornecedor_id, {
      total: atual.total + Number(despesa.valor ?? 0),
      lancamentos: atual.lancamentos + 1,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-black">Fornecedores</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Visualize, cadastre e edite lojas, prestadores e empresas.
          </p>
        </div>
        <CadastroModal
          titulo="Novo fornecedor"
          descricao="Cadastre nomes fáceis de reconhecer no momento do lançamento."
          botao="+ Cadastrar fornecedor"
          variante="primario"
        >
          <form action={createFornecedorAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Nome
              <input
                name="nome"
                required
                placeholder="Ex: Depósito Central"
                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Contato
              <input
                name="contato"
                placeholder="Telefone, WhatsApp ou observação"
                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
              />
            </label>
            <button
              type="submit"
              className="rounded-brand-sm bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-700"
            >
              Salvar fornecedor
            </button>
          </form>
        </CadastroModal>
      </div>

      <section className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="border-b border-brand-gray-300/60 px-5 py-4">
          <p className="text-sm font-semibold text-brand-black">Tabela de fornecedores</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Lojas, prestadores e empresas usados nos lançamentos do WhatsApp e do dashboard.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-brand-gray-100 text-[11px] uppercase tracking-[0.12em] text-brand-gray-500">
              <tr>
                <th className="px-5 py-3 font-extrabold">Fornecedor</th>
                <th className="px-5 py-3 font-extrabold">Contato</th>
                <th className="px-5 py-3 font-extrabold">CNPJ</th>
                <th className="px-5 py-3 font-extrabold">Uso</th>
                <th className="px-5 py-3 font-extrabold">Cadastrado</th>
                <th className="px-5 py-3 text-right font-extrabold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-gray-300/40">
              {lista.map((fornecedor) => {
                const uso = usoPorFornecedor.get(fornecedor.id);
                return (
                  <tr key={fornecedor.id} className="align-middle hover:bg-brand-gray-100/55">
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/despesas?fornecedor=${fornecedor.id}`}
                        className="font-semibold text-brand-black hover:text-brand-red hover:underline"
                        title="Ver lançamentos deste fornecedor"
                      >
                        {fornecedor.nome}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-brand-gray-700">
                      {fornecedor.contato || "—"}
                    </td>
                    <td className="px-5 py-4 text-brand-gray-700">
                      {fornecedor.cnpj || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Badge>{uso?.lancamentos ?? 0}</Badge>
                    </td>
                    <td className="px-5 py-4 text-brand-gray-500">
                      {new Date(fornecedor.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <CadastroModal
                          titulo="Editar fornecedor"
                          descricao="Atualize os dados usados nos lançamentos e relatórios."
                          botao="Editar"
                          icone={<ActionIcon name="edit" />}
                          variante="icone"
                        >
                          <form action={updateFornecedorModalAction} className="flex flex-col gap-4">
                            <input type="hidden" name="id" value={fornecedor.id} />
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Nome
                              <input
                                name="nome"
                                defaultValue={fornecedor.nome}
                                required
                                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Contato
                              <input
                                name="contato"
                                defaultValue={fornecedor.contato ?? ""}
                                className="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              CNPJ
                              <input
                                name="cnpj"
                                defaultValue={fornecedor.cnpj ?? ""}
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
                          id={fornecedor.id}
                          nome={fornecedor.nome}
                          entidade="Fornecedor"
                          usadoEm={uso?.lancamentos ?? 0}
                          detalhesUso={`${uso?.lancamentos ?? 0} lançamento(s) vinculados.`}
                          action={deleteFornecedorAction}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-brand-gray-500">
                    Nenhum fornecedor cadastrado ainda.
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
