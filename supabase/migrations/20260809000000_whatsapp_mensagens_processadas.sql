-- Guarda o id (wamid) de cada mensagem do WhatsApp ja processada, pra
-- reentregas da Meta (coisa real e documentada) nao criarem lancamentos
-- duplicados quando o webhook recebe a mesma mensagem duas vezes.
create table if not exists whatsapp_mensagens_processadas (
  wamid text primary key,
  created_at timestamptz not null default now()
);

alter table whatsapp_mensagens_processadas enable row level security;

create policy "authenticated full access" on whatsapp_mensagens_processadas
  for all to authenticated using (true) with check (true);
