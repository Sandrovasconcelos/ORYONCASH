import { createAdminClient } from "@/lib/supabase/admin";
import { updateConfiguracaoNotificacaoAction, testarNotificacaoAction } from "../actions";
import { SubmitButton } from "../submit-button";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ salvo?: string; teste?: string; alertas?: string; motivo?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const { data: config, error } = await supabase
    .from("configuracoes_notificacao")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  const moduloIndisponivel = Boolean(error);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card border border-brand-gray-300/60 bg-white p-5 shadow-card">
        <p className="text-sm font-semibold text-brand-black">Configurações</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-gray-500">
          Preferências gerais do sistema. Por enquanto, controla os alertas diários que o
          OryonCash manda pro seu WhatsApp.
        </p>
      </section>

      {params.salvo && (
        <Banner tone="success">Configuração de notificações salva.</Banner>
      )}
      {params.teste === "enviado" && (
        <Banner tone="success">
          Notificação de teste enviada com {params.alertas ?? "0"} alerta(s). Confira o WhatsApp cadastrado.
        </Banner>
      )}
      {params.teste === "sem_envio" && (
        <Banner tone="warning">
          Nada foi enviado: {params.motivo || "nenhum alerta pendente no momento."}
        </Banner>
      )}

      {moduloIndisponivel ? (
        <div className="rounded-card border border-status-warning/30 bg-status-warning/10 p-5 text-sm text-brand-gray-700 shadow-card">
          <p className="font-semibold text-brand-black">Notificações ainda não ativadas no Supabase.</p>
          <p className="mt-1">
            Aplique a migration <code>20260812000000_configuracoes_notificacao.sql</code> pra
            liberar essa seção.
          </p>
        </div>
      ) : (
        <section className="rounded-card border border-brand-gray-300/60 bg-white shadow-card">
          <div className="flex flex-col gap-1 border-b border-brand-gray-300/60 px-5 py-4">
            <p className="text-sm font-semibold text-brand-black">🔔 Notificações no WhatsApp</p>
            <p className="text-xs text-brand-gray-500">
              1x por dia, de manhã, o OryonCash manda um resumo dos pontos de atenção pra esse
              número. Cada mensagem chega com o cabeçalho "🏗️ OryonCash — Alerta diário" — o
              WhatsApp não deixa personalizar o nome ou a foto de quem envia, só o conteúdo.
            </p>
          </div>

          <form action={updateConfiguracaoNotificacaoAction} className="flex flex-col gap-5 p-5">
            <label className="flex flex-col gap-1 text-sm text-brand-gray-700 sm:max-w-xs">
              Número do WhatsApp
              <input
                name="numero_whatsapp"
                defaultValue={config?.numero_whatsapp ?? ""}
                inputMode="numeric"
                placeholder="Ex: 5598988219864"
                className="oc-input"
              />
              <span className="text-xs font-normal text-brand-gray-500">
                Com DDI e DDD, só números.
              </span>
            </label>

            <div className="flex flex-col gap-3">
              <ToggleRow
                name="notificar_atraso"
                defaultChecked={config?.notificar_atraso ?? true}
                titulo="Etapa atrasada"
                descricao="Fases do cronograma detalhado com o prazo estourando o progresso real."
              />
              <ToggleRow
                name="notificar_estouro"
                defaultChecked={config?.notificar_estouro ?? true}
                titulo="Orçamento estourado"
                descricao="Contratos de fornecedor com valor pago acima do contratado."
              />
              <ToggleRow
                name="notificar_saldo_negativo"
                defaultChecked={config?.notificar_saldo_negativo ?? true}
                titulo="Saldo de conta bancária negativo"
                descricao="Contas com saldo atual (inicial menos gasto) abaixo de zero."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-brand-gray-300/60 pt-4">
              <SubmitButton className="oc-button oc-button-primary">Salvar</SubmitButton>
              <span className="text-xs text-brand-gray-500">
                Salve o número antes de testar.
              </span>
            </div>
          </form>

          <div className="flex items-center justify-between gap-3 border-t border-brand-gray-300/60 bg-brand-gray-100/40 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-brand-black">Testar agora</p>
              <p className="text-xs text-brand-gray-500">
                Dispara a mesma checagem do cron diário na hora, sem esperar amanhã de manhã.
              </p>
            </div>
            <form action={testarNotificacaoAction}>
              <SubmitButton className="oc-button oc-button-dark text-xs">
                🔔 Testar agora
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      <section className="rounded-card border border-dashed border-brand-gray-300/60 bg-brand-gray-100/30 p-5 text-sm text-brand-gray-500">
        Mais opções de configuração chegam aqui conforme o sistema crescer.
      </section>
    </div>
  );
}

function ToggleRow({
  name,
  defaultChecked,
  titulo,
  descricao,
}: {
  name: string;
  defaultChecked: boolean;
  titulo: string;
  descricao: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-brand-sm border border-brand-gray-300/60 p-3 hover:bg-brand-gray-100/50">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-brand-red"
      />
      <span>
        <span className="block text-sm font-semibold text-brand-black">{titulo}</span>
        <span className="block text-xs text-brand-gray-500">{descricao}</span>
      </span>
    </label>
  );
}

function Banner({ tone, children }: { tone: "success" | "warning"; children: React.ReactNode }) {
  const classe =
    tone === "success"
      ? "border-status-success/30 bg-[#e9f8f0] text-status-success"
      : "border-status-warning/30 bg-status-warning/10 text-brand-gray-700";
  return (
    <div className={`rounded-card border p-4 text-sm font-semibold shadow-card ${classe}`}>
      {children}
    </div>
  );
}
