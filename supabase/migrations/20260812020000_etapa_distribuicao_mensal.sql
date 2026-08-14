-- Distribuicao mes a mes de cada etapa (percentual + duracao), pra tabela
-- "Fisico-financeiro" do Cronograma. Os meses da obra sao derivados das
-- datas previstas das proprias etapas (nao ha uma config separada de
-- "quantidade de meses" - menos uma coisa pra manter sincronizada).
create table if not exists etapa_distribuicao_mensal (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references etapas(id) on delete cascade,
  mes date not null,
  percentual numeric not null default 0,
  duracao_dias integer not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (etapa_id, mes)
);

create index if not exists idx_etapa_distribuicao_mensal_etapa
  on etapa_distribuicao_mensal(etapa_id);

alter table etapa_distribuicao_mensal enable row level security;

create policy "authenticated full access" on etapa_distribuicao_mensal
  for all to authenticated using (true) with check (true);
