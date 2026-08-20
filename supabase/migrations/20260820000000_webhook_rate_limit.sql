create table if not exists webhook_rate_limit (
  telefone text primary key,
  contador int not null default 1,
  janela_inicio timestamptz not null default now()
);

alter table webhook_rate_limit enable row level security;

create policy "authenticated full access" on webhook_rate_limit
  for all to authenticated using (true) with check (true);
