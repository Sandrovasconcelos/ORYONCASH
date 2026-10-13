-- Assistente pessoal: compromissos e lembretes por WhatsApp/Telegram.
-- Cada compromisso pertence a quem o criou (telefone do WhatsApp ou tg_<id> do
-- Telegram) - agenda pessoal, separada das financas da empresa.
create table if not exists compromissos (
  id uuid primary key default gen_random_uuid(),
  telefone text not null,
  titulo text not null,
  local text,
  inicio timestamptz not null,
  lembrar_min_antes integer not null default 30,
  lembrete_enviado_em timestamptz,
  status text not null default 'agendado' check (status in ('agendado', 'cancelado', 'concluido')),
  origem text not null default 'whatsapp',
  created_at timestamptz not null default now()
);

create index if not exists compromissos_telefone_inicio_idx on compromissos (telefone, inicio);
create index if not exists compromissos_lembretes_idx on compromissos (inicio) where status = 'agendado' and lembrete_enviado_em is null;

alter table compromissos enable row level security;
