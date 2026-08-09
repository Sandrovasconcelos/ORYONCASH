import { createClient } from "@/lib/supabase/server";
import {
  createNumeroAction,
  deleteNumeroAction,
  toggleNumeroAtivoAction,
  updateNumeroAction,
} from "../actions";
import { ActionIcon } from "../action-icon";
import { CadastroModal } from "../cadastro-modal";
import { NumeroActionButton } from "./numero-action-button";
import { SubmitButton } from "../submit-button";

export const dynamic = "force-dynamic";

export default async function NumerosPage() {
  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("usuarios_whatsapp")
    .select("telefone, nome, ativo, created_at")
    .order("created_at", { ascending: false });

  const lista = usuarios ?? [];
  const ativos = lista.filter((u) => u.ativo).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-black">Acessos WhatsApp</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Controle quem pode conversar com o bot e registrar lançamentos pelo WhatsApp.
          </p>
        </div>
        <CadastroModal
          titulo="Autorizar novo número"
          descricao="Use telefone com DDI e DDD. Exemplo: 5598988219864."
          botao="+ Autorizar número"
          variante="primario"
        >
          <form action={createNumeroAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Nome
              <input
                name="nome"
                required
                placeholder="Ex: João Pedreiro"
                className="oc-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Telefone
              <input
                name="telefone"
                required
                inputMode="numeric"
                placeholder="Ex: 5598988219864"
                className="oc-input"
              />
            </label>
            <SubmitButton className="oc-button oc-button-primary">
              Autorizar acesso
            </SubmitButton>
          </form>
        </CadastroModal>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ResumoCard label="Números cadastrados" valor={String(lista.length)} />
        <ResumoCard label="Ativos" valor={String(ativos)} destaque />
        <ResumoCard label="Inativos" valor={String(lista.length - ativos)} />
      </div>

      <section className="oc-table-wrap">
        <div className="oc-section-header">
          <p className="text-sm font-semibold text-brand-black">Tabela de acessos</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Usuários ativos podem registrar despesas, obras e cadastros pelo fluxo do WhatsApp.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="oc-table min-w-[780px]">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Cadastrado</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.telefone}>
                  <td>
                    <p className="font-semibold text-brand-black">{u.nome}</p>
                    <p className="mt-1 text-xs text-brand-gray-500">Acesso ao módulo central</p>
                  </td>
                  <td className="font-medium text-brand-gray-700">{u.telefone}</td>
                  <td>
                    <span
                      className={
                        u.ativo
                          ? "inline-flex rounded-full bg-status-success/15 px-3 py-1 text-xs font-bold text-status-success"
                          : "inline-flex rounded-full bg-brand-gray-100 px-3 py-1 text-xs font-bold text-brand-gray-500"
                      }
                    >
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-brand-gray-500">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <CadastroModal
                        titulo="Editar número"
                        descricao="O telefone não pode ser alterado - para trocar o número, remova e autorize um novo."
                        botao="Editar"
                        icone={<ActionIcon name="edit" />}
                        variante="icone"
                      >
                        <form action={updateNumeroAction} className="flex flex-col gap-4">
                          <input type="hidden" name="telefone" value={u.telefone} />
                          <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                            Nome
                            <input
                              name="nome"
                              defaultValue={u.nome}
                              required
                              className="oc-input"
                            />
                          </label>
                          <SubmitButton className="oc-button oc-button-primary">
                            Salvar edição
                          </SubmitButton>
                        </form>
                      </CadastroModal>
                      <NumeroActionButton
                        telefone={u.telefone}
                        ativo={u.ativo}
                        tipo="toggle"
                        action={toggleNumeroAtivoAction}
                      />
                      <NumeroActionButton
                        telefone={u.telefone}
                        tipo="delete"
                        action={deleteNumeroAction}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              {lista.length === 0 && (
                <tr>
                  <td colSpan={5} className="oc-empty">
                    Nenhum número autorizado ainda.
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

function ResumoCard({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-card border border-brand-gray-300/60 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold text-brand-gray-500">{label}</p>
      <p
        className={
          destaque
            ? "mt-1 font-display text-xl font-bold text-brand-red"
            : "mt-1 font-display text-xl font-bold text-brand-black"
        }
      >
        {valor}
      </p>
    </div>
  );
}
