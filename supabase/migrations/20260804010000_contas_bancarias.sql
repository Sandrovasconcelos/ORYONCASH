create table if not exists contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  banco text,
  agencia text,
  numero text,
  saldo_inicial numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text
);

alter table despesas
  add column if not exists conta_bancaria_id uuid references contas_bancarias(id);

create index if not exists despesas_conta_bancaria_id_idx on despesas(conta_bancaria_id);

alter table contas_bancarias enable row level security;

create policy "authenticated full access" on contas_bancarias
  for all to authenticated using (true) with check (true);
