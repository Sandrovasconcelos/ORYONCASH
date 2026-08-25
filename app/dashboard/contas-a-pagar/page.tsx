import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/conversation/format";
import { criarContaAPagarAction } from "./actions";
import { SubmitButton } from "../submit-button";
import { ContaAPagarLinha } from "./conta-a-pagar-linha";

export const dynamic = "force-dynamic";

export default async function ContasAPagarPage() {
  const supabase = createAdminClient();

  const [{ data: obras }, { data: categorias }, { data: fornecedores }, contasQuery] = await Promise.all([
    supabase.from("obras").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("categorias").select("id, nome").is("deleted_at", null).order("nome"),
    supabase.from("fornecedores").select("id, nome").is("deleted_at", null).order("nome"),
    supabase
      .from("contas_a_pagar")
      .select(
        "id, descricao, valor, data_vencimento, recorrencia, avisar_dias_antes, status, obras(nome), categorias(nome), fornecedores(nome), storage_bucket, storage_path"
      )
      .order("data_vencimento"),
  ]);

  if (contasQuery.error) {
    return (
      <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
        <p className="font-semibold text-brand-black">Contas a pagar ainda não ativado no Supabase.</p>
        <p className="mt-1">
          Aplique a migration <code>20260825020000_contas_a_pagar.sql</code> pra liberar essa tela.
        </p>
      </div>
    );
  }

  const contas = contasQuery.data ?? [];
  const hoje = new Date().toISOString().slice(0, 10);

  const pendentes = contas.filter((c) => c.status === "pendente" && c.data_vencimento >= hoje);
  const vencidas = contas.filter((c) => c.status === "pendente" && c.data_vencimento < hoje);
  const pagas = contas.filter((c) => c.status === "pago");

  const totalPendente = [...pendentes, ...vencidas].reduce((soma, c) => soma + c.valor, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-brand-black">Contas a pagar</h1>
          <p className="mt-1 text-sm text-brand-gray-600">
            Cadastre contas avulsas (aluguel, luz) ou de fornecedor com data de vencimento — o
            WhatsApp avisa quando estiver perto de vencer.
          </p>
        </div>
        <div className="shrink-0 rounded-card border border-black/5 bg-white px-4 py-3 text-center shadow-card">
          <p className="text-lg font-black text-brand-black">{formatBRL(totalPendente)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-brand-gray-500">a pagar</p>
        </div>
      </div>

      <form
        action={criarContaAPagarAction}
        className="flex flex-col gap-4 rounded-card border border-black/5 bg-white p-5 shadow-card"
      >
        <p className="text-sm font-bold text-brand-black">Nova conta a pagar</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Descrição
            <input
              name="descricao"
              required
              placeholder="Ex: Aluguel da sala"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Valor
            <input
              name="valor"
              required
              placeholder="0,00"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Vencimento
            <input
              type="date"
              name="data_vencimento"
              required
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Obra
            <select
              name="obra_id"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            >
              <option value="">Sem obra (Administrativo)</option>
              {(obras ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Categoria
            <select
              name="categoria_id"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            >
              <option value="">Selecione…</option>
              {(categorias ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Fornecedor (opcional)
            <select
              name="fornecedor_id"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            >
              <option value="">—</option>
              {(fornecedores ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Repete?
            <select
              name="recorrencia"
              defaultValue="nenhuma"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            >
              <option value="nenhuma">Não repete</option>
              <option value="semanal">Toda semana</option>
              <option value="mensal">Todo mês</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Avisar quantos dias antes?
            <input
              type="number"
              name="avisar_dias_antes"
              defaultValue={3}
              min={0}
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-brand-gray-600">
            Arquivo da conta/boleto (opcional)
            <input
              type="file"
              name="arquivo"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-black file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
            />
          </label>
        </div>
        <SubmitButton
          pendingText="Salvando..."
          className="self-start rounded-brand-sm bg-brand-red px-5 py-2.5 text-sm font-extrabold text-white shadow-card hover:brightness-110"
        >
          Cadastrar
        </SubmitButton>
      </form>

      {vencidas.length > 0 && (
        <Secao titulo="⚠️ Vencidas" contas={vencidas} hoje={hoje} />
      )}
      <Secao titulo="Pendentes" contas={pendentes} hoje={hoje} />
      {pagas.length > 0 && <Secao titulo="Pagas recentemente" contas={pagas.slice(0, 20)} hoje={hoje} />}
    </div>
  );
}

type ContaAPagarRow = {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  recorrencia: "nenhuma" | "semanal" | "mensal";
  status: "pendente" | "pago" | "cancelado";
  storage_path: string | null;
  obras?: { nome: string } | null;
  categorias?: { nome: string } | null;
  fornecedores?: { nome: string } | null;
};

function Secao({
  titulo,
  contas,
  hoje,
}: {
  titulo: string;
  contas: ContaAPagarRow[];
  hoje: string;
}) {
  return (
    <div className="rounded-card border border-black/5 bg-white shadow-card">
      <div className="border-b border-black/5 px-5 py-3">
        <p className="text-sm font-bold text-brand-black">{titulo}</p>
      </div>
      {contas.length === 0 ? (
        <p className="p-5 text-sm text-brand-gray-500">Nada por aqui.</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {contas.map((c) => (
            <ContaAPagarLinha
              key={c.id}
              id={c.id}
              descricao={c.descricao}
              valor={c.valor}
              dataVencimento={c.data_vencimento}
              recorrencia={c.recorrencia}
              status={c.status}
              obraNome={c.obras?.nome ?? null}
              categoriaNome={c.categorias?.nome ?? null}
              fornecedorNome={c.fornecedores?.nome ?? null}
              temArquivo={Boolean(c.storage_path)}
              vencida={c.status === "pendente" && c.data_vencimento < hoje}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
