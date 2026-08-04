create table if not exists contratos_fornecedor (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  fornecedor_id uuid not null references fornecedores(id),
  descricao text,
  valor_contrato numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text
);

create index if not exists contratos_fornecedor_obra_id_idx on contratos_fornecedor(obra_id);
create index if not exists contratos_fornecedor_fornecedor_id_idx on contratos_fornecedor(fornecedor_id);

alter table contratos_fornecedor enable row level security;

create policy "authenticated full access" on contratos_fornecedor
  for all to authenticated using (true) with check (true);
