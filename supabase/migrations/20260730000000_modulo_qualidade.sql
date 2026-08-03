alter table etapas
  add column if not exists fornecedor_id uuid references fornecedores(id),
  add column if not exists situacao_qualidade text not null default 'nao_inspecionado'
    check (situacao_qualidade in ('nao_inspecionado', 'aprovado', 'pendente', 'reprovado'));

create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text
);

create table if not exists checklist_itens (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates(id) on delete cascade,
  descricao text not null,
  critico boolean not null default false,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

alter table etapas
  add column if not exists checklist_template_id uuid references checklist_templates(id);

create table if not exists inspecoes (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references etapas(id) on delete cascade,
  template_id uuid references checklist_templates(id),
  resultado text not null check (resultado in ('aprovado', 'pendente', 'reprovado')),
  observacao text,
  inspecionado_por text,
  origem text not null default 'dashboard' check (origem in ('dashboard')),
  created_at timestamptz not null default now()
);

create table if not exists inspecao_respostas (
  id uuid primary key default gen_random_uuid(),
  inspecao_id uuid not null references inspecoes(id) on delete cascade,
  checklist_item_id uuid not null references checklist_itens(id),
  resposta text not null check (resposta in ('aprovado', 'pendente', 'reprovado', 'nao_aplica')),
  created_at timestamptz not null default now()
);

create table if not exists inspecao_evidencias (
  id uuid primary key default gen_random_uuid(),
  inspecao_id uuid not null references inspecoes(id) on delete cascade,
  storage_bucket text not null default 'comprovantes',
  storage_path text not null,
  mime_type text not null,
  nome_arquivo text,
  created_at timestamptz not null default now()
);

create index if not exists checklist_itens_template_id_idx on checklist_itens(template_id);
create index if not exists inspecoes_etapa_id_idx on inspecoes(etapa_id);
create index if not exists inspecao_respostas_inspecao_id_idx on inspecao_respostas(inspecao_id);
create index if not exists inspecao_evidencias_inspecao_id_idx on inspecao_evidencias(inspecao_id);

alter table checklist_templates enable row level security;
alter table checklist_itens enable row level security;
alter table inspecoes enable row level security;
alter table inspecao_respostas enable row level security;
alter table inspecao_evidencias enable row level security;

create policy "authenticated full access" on checklist_templates
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on checklist_itens
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on inspecoes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on inspecao_respostas
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on inspecao_evidencias
  for all to authenticated using (true) with check (true);
