alter table etapas
  add column if not exists data_inicio_prevista date,
  add column if not exists data_fim_prevista date,
  add column if not exists percentual_executado numeric(5, 2) not null default 0
    check (percentual_executado >= 0 and percentual_executado <= 100);

create table if not exists medicoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  categoria_id uuid not null references categorias(id),
  periodo_inicio date not null,
  periodo_fim date not null,
  status text not null default 'preparada'
    check (status in ('preparada', 'aprovada', 'paga')),
  valor_total numeric(14, 2) not null default 0,
  observacao text,
  criado_por text,
  aprovado_por text,
  aprovado_em timestamptz,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text
);

create table if not exists medicao_itens (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references medicoes(id) on delete cascade,
  etapa_id uuid not null references etapas(id),
  fornecedor_id uuid references fornecedores(id),
  percentual_medido numeric(5, 2) not null,
  valor_medido numeric(14, 2) not null,
  despesa_id uuid references despesas(id),
  created_at timestamptz not null default now()
);

create index if not exists medicoes_obra_id_idx on medicoes(obra_id);
create index if not exists medicao_itens_medicao_id_idx on medicao_itens(medicao_id);
create index if not exists medicao_itens_etapa_id_idx on medicao_itens(etapa_id);

alter table medicoes enable row level security;
alter table medicao_itens enable row level security;

create policy "authenticated full access" on medicoes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on medicao_itens
  for all to authenticated using (true) with check (true);
