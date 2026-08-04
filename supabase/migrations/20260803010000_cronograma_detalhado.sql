create table if not exists cronograma_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text
);

create table if not exists cronograma_template_fases (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references cronograma_templates(id) on delete cascade,
  nome text not null,
  ordem int not null default 1,
  mes_inicio int not null default 1,
  duracao_meses int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists cronograma_template_atividades (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references cronograma_template_fases(id) on delete cascade,
  descricao text not null,
  ordem int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists obra_cronograma_fases (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  ordem int not null default 1,
  data_inicio_prevista date not null,
  data_fim_prevista date not null,
  created_at timestamptz not null default now()
);

create table if not exists obra_cronograma_atividades (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references obra_cronograma_fases(id) on delete cascade,
  etapa_id uuid references etapas(id),
  descricao text not null,
  ordem int not null default 1,
  status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'concluida')),
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists obra_cronograma_fases_obra_id_idx on obra_cronograma_fases(obra_id);
create index if not exists obra_cronograma_atividades_fase_id_idx on obra_cronograma_atividades(fase_id);
create index if not exists cronograma_template_fases_template_id_idx on cronograma_template_fases(template_id);
create index if not exists cronograma_template_atividades_fase_id_idx on cronograma_template_atividades(fase_id);

alter table cronograma_templates enable row level security;
alter table cronograma_template_fases enable row level security;
alter table cronograma_template_atividades enable row level security;
alter table obra_cronograma_fases enable row level security;
alter table obra_cronograma_atividades enable row level security;

create policy "authenticated full access" on cronograma_templates
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on cronograma_template_fases
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on cronograma_template_atividades
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on obra_cronograma_fases
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on obra_cronograma_atividades
  for all to authenticated using (true) with check (true);
