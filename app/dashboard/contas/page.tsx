import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import {
  createContaBancariaAction,
  deleteContaBancariaAction,
  updateContaBancariaAction,
} from "../actions";
import { CadastroModal } from "../cadastro-modal";
import { DeleteCadastroButton } from "../delete-cadastro-button";
import { ActionIcon } from "../action-icon";

export const dynamic = "force-dynamic";

export default async function ContasBancariasPage() {
  const supabase = createAdminClient();

  const contasCompleta = await supabase
    .from("contas_bancarias")
    .select("id, nome, banco, agencia, numero, titular, documento, saldo_inicial")
    .is("deleted_at", null)
    .order("nome");
  const contasQuery = contasCompleta.error
    ? await supabase
        .from("contas_bancarias")
        .select("id, nome, banco, agencia, numero, saldo_inicial")
        .is("deleted_at", null)
        .order("nome")
    : contasCompleta;

  const moduloIndisponivel = Boolean(contasQuery.error);

  if (moduloIndisponivel) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Contas bancárias ainda não ativado no Supabase.</p>
        <p className="mt-1">
          Aplique a migration <code>20260804010000_contas_bancarias.sql</code> pra liberar
          esse cadastro.
        </p>
      </div>
    );
  }

  const contas = contasQuery.data ?? [];

  const { data: despesasVinculadas } = await supabase
    .from("despesas")
    .select("conta_bancaria_id, valor")
    .is("deleted_at", null)
    .not("conta_bancaria_id", "is", null);

  const gastoPorConta = new Map<string, number>();
  const lancamentosPorConta = new Map<string, number>();
  for (const despesa of despesasVinculadas ?? []) {
    if (!despesa.conta_bancaria_id) continue;
    gastoPorConta.set(
      despesa.conta_bancaria_id,
      (gastoPorConta.get(despesa.conta_bancaria_id) ?? 0) + Number(despesa.valor ?? 0)
    );
    lancamentosPorConta.set(
      despesa.conta_bancaria_id,
      (lancamentosPorConta.get(despesa.conta_bancaria_id) ?? 0) + 1
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-black">Contas bancárias</p>
          <p className="mt-1 text-xs text-brand-gray-500">
            Cadastre as contas que pagam as obras pra acompanhar o saldo de cada uma.
          </p>
        </div>
        <CadastroModal
          titulo="Nova conta bancária"
          descricao="Titular e documento são o que diferencia contas do mesmo banco ao reconhecer comprovantes do WhatsApp automaticamente."
          botao="+ Nova conta"
          variante="primario"
        >
          <form action={createContaBancariaAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Nome (apelido)
              <input name="nome" required placeholder="Ex: Caixa - Oryon" className="oc-input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                Banco
                <input name="banco" placeholder="Ex: Caixa Econômica Federal" className="oc-input" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                Agência
                <input name="agencia" className="oc-input" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Número da conta
              <input name="numero" className="oc-input" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Titular (como aparece no comprovante)
              <input name="titular" placeholder="Ex: Oryon Construção e E. Ltda" className="oc-input" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              CNPJ/CPF do titular
              <input name="documento" placeholder="Só números" className="oc-input" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
              Saldo inicial
              <input name="saldo_inicial" placeholder="0,00" className="oc-input" />
            </label>
            <button type="submit" className="oc-button oc-button-primary">
              Salvar conta
            </button>
          </form>
        </CadastroModal>
      </div>

      <div className="overflow-hidden rounded-card border border-brand-gray-300/60 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="oc-table min-w-[860px]">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Banco</th>
                <th>Titular</th>
                <th>Agência / Número</th>
                <th className="text-right">Saldo inicial</th>
                <th className="text-right">Pago</th>
                <th className="text-right">Saldo atual</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => {
                const contaInfo = conta as unknown as {
                  titular: string | null;
                  documento: string | null;
                };
                const pago = gastoPorConta.get(conta.id) ?? 0;
                const saldoAtual = Number(conta.saldo_inicial) - pago;
                return (
                  <tr key={conta.id}>
                    <td className="font-semibold text-brand-black">{conta.nome}</td>
                    <td className="text-brand-gray-700">{conta.banco || "—"}</td>
                    <td className="text-brand-gray-700">
                      <p>{contaInfo.titular || "—"}</p>
                      {contaInfo.documento && (
                        <p className="text-[11px] text-brand-gray-500">{contaInfo.documento}</p>
                      )}
                    </td>
                    <td className="text-brand-gray-700">
                      {conta.agencia || "—"} / {conta.numero || "—"}
                    </td>
                    <td className="text-right text-brand-gray-700">
                      {formatBRL(Number(conta.saldo_inicial))}
                    </td>
                    <td className="text-right text-brand-gray-700">{formatBRL(pago)}</td>
                    <td
                      className={`text-right font-extrabold ${saldoAtual < 0 ? "text-status-danger" : "text-brand-black"}`}
                    >
                      {formatBRL(saldoAtual)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <CadastroModal
                          titulo="Editar conta bancária"
                          descricao="Ajuste nome, banco, agência, número e saldo inicial."
                          botao="Editar"
                          icone={<ActionIcon name="edit" />}
                          variante="icone"
                        >
                          <form action={updateContaBancariaAction} className="flex flex-col gap-4">
                            <input type="hidden" name="id" value={conta.id} />
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Nome (apelido)
                              <input name="nome" defaultValue={conta.nome} required className="oc-input" />
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                Banco
                                <input name="banco" defaultValue={conta.banco ?? ""} className="oc-input" />
                              </label>
                              <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                                Agência
                                <input name="agencia" defaultValue={conta.agencia ?? ""} className="oc-input" />
                              </label>
                            </div>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Número da conta
                              <input name="numero" defaultValue={conta.numero ?? ""} className="oc-input" />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Titular (como aparece no comprovante)
                              <input name="titular" defaultValue={contaInfo.titular ?? ""} className="oc-input" />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              CNPJ/CPF do titular
                              <input name="documento" defaultValue={contaInfo.documento ?? ""} className="oc-input" />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
                              Saldo inicial
                              <input
                                name="saldo_inicial"
                                defaultValue={Number(conta.saldo_inicial).toFixed(2).replace(".", ",")}
                                className="oc-input"
                              />
                            </label>
                            <button type="submit" className="oc-button oc-button-primary">
                              Salvar edição
                            </button>
                          </form>
                        </CadastroModal>

                        <DeleteCadastroButton
                          id={conta.id}
                          nome={conta.nome}
                          entidade="Conta bancária"
                          usadoEm={lancamentosPorConta.get(conta.id) ?? 0}
                          detalhesUso={`${lancamentosPorConta.get(conta.id) ?? 0} lançamento(s) vinculado(s).`}
                          action={deleteContaBancariaAction}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {contas.length === 0 && (
                <tr>
                  <td colSpan={8} className="oc-empty">
                    Nenhuma conta bancária cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
