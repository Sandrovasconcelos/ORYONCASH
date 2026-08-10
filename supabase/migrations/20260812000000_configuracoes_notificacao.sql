create table if not exists configuracoes_notificacao (
  id boolean primary key default true check (id),
  numero_whatsapp text,
  notificar_atraso boolean not null default true,
  notificar_estouro boolean not null default true,
  notificar_saldo_negativo boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into configuracoes_notificacao (id) values (true) on conflict do nothing;

alter table configuracoes_notificacao enable row level security;

create policy "authenticated full access" on configuracoes_notificacao
  for all
  to authenticated
  using (true)
  with check (true);
