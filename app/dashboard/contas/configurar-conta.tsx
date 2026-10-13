import { formatBRL } from "@/lib/conversation/format";
import { formatDataBrasil } from "@/lib/format-date";
import { CadastroModal } from "../cadastro-modal";
import { SubmitButton } from "../submit-button";
import { FecharAoEnviar } from "../fechar-ao-enviar";
import { ExcluirComConfirmacao } from "../excluir-com-confirmacao";
import { configurarContaAction, excluirSaldoAction, registrarSaldoAction } from "./actions";

const CAMPO = "w-full rounded-brand-sm border border-black/10 bg-white px-3 py-2 text-sm font-medium text-brand-black";
const ROTULO = "flex flex-col gap-1 text-xs font-bold text-brand-gray-600";

export type SaldoInformado = { id: string; data: string; valor: number; observacao: string | null };

/** Tipo da conta, data do saldo inicial e os saldos que o banco mostrou (usados no fechamento de caixa). */
export function ConfigurarConta({
  conta,
  saldos,
  hoje,
}: {
  conta: { id: string; nome: string; tipo: "corrente" | "investimento"; data_saldo_inicial: string | null };
  saldos: SaldoInformado[];
  hoje: string;
}) {
  const investimento = conta.tipo === "investimento";
  return (
    <CadastroModal
      titulo={`Caixa: ${conta.nome}`}
      descricao="Tipo da conta e saldos do extrato, para o fechamento mensal conferir."
      botao="Caixa e saldos"
      triggerClassName="rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2 text-xs font-bold text-brand-black hover:bg-brand-gray-100"
      modalSize="wide"
    >
      <div className="flex flex-col gap-6 text-left">
        <form action={configurarContaAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={conta.id} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={ROTULO}>
              Tipo da conta
              <select name="tipo" defaultValue={conta.tipo} className={CAMPO}>
                <option value="corrente">Conta corrente (movimento do dia a dia)</option>
                <option value="investimento">Investimento (dinheiro aplicado)</option>
              </select>
            </label>
            <label className={ROTULO}>
              O saldo inicial vale para o dia
              <input type="date" name="data_saldo_inicial" defaultValue={conta.data_saldo_inicial ?? ""} className={CAMPO} />
            </label>
          </div>
          <p className="text-xs text-brand-gray-500">
            O fechamento começa a contar do dia seguinte a essa data, com o saldo inicial da conta. Use o dia anterior ao primeiro extrato que você vai conciliar.
          </p>
          <FecharAoEnviar />
          <SubmitButton className="oc-button oc-button-primary self-start">Salvar tipo e data</SubmitButton>
        </form>

        <div>
          <p className="text-sm font-bold text-brand-black">{investimento ? "Posição do investimento" : "Saldos do extrato"}</p>
          <p className="mb-3 text-xs text-brand-gray-500">
            {investimento
              ? "Quanto estava aplicado em cada data (fim do mês). O rendimento do período sai da diferença."
              : "Saldo que o banco mostra no fim do extrato. Informe o do último dia de cada mês: é com ele que o fechamento confere."}
          </p>
          {saldos.length > 0 ? (
            <ul className="mb-4 divide-y divide-black/5 rounded-card border border-black/5">
              {saldos.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="text-brand-gray-600">{formatDataBrasil(s.data)}</span>
                  <span className="font-bold text-brand-black">{formatBRL(s.valor)}</span>
                  {s.observacao && <span className="text-xs text-brand-gray-500">{s.observacao}</span>}
                  <span className="ml-auto">
                    <ExcluirComConfirmacao
                      id={s.id}
                      titulo="Excluir saldo informado?"
                      descricao={`${formatDataBrasil(s.data)} · ${formatBRL(s.valor)}`}
                      action={excluirSaldoAction}
                      rotulo="Excluir saldo"
                      compacto
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-xs text-brand-gray-500">Nenhum saldo informado ainda.</p>
          )}

          <form action={registrarSaldoAction} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
            <input type="hidden" name="conta_bancaria_id" value={conta.id} />
            <label className={ROTULO}>
              Data
              <input type="date" name="data" required defaultValue={hoje} className={CAMPO} />
            </label>
            <label className={ROTULO}>
              Saldo (R$)
              <input name="valor" required inputMode="decimal" placeholder="0,00" className={CAMPO} />
            </label>
            <label className={ROTULO}>
              Observação
              <input name="observacao" className={CAMPO} />
            </label>
            <SubmitButton className="oc-button oc-button-dark text-xs" pendingText="Salvando...">
              Informar saldo
            </SubmitButton>
          </form>
        </div>
      </div>
    </CadastroModal>
  );
}
