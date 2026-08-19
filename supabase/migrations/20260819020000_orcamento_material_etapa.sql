create table if not exists orcamento_material_etapa (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references etapas(id) on delete cascade,
  material_id uuid not null references materiais(id) on delete cascade,
  quantidade_orcada numeric(12, 3) not null,
  created_at timestamptz not null default now(),
  unique (etapa_id, material_id)
);

create index if not exists orcamento_material_etapa_etapa_id_idx on orcamento_material_etapa(etapa_id);
create index if not exists orcamento_material_etapa_material_id_idx on orcamento_material_etapa(material_id);

alter table orcamento_material_etapa enable row level security;

create policy "authenticated full access" on orcamento_material_etapa
  for all to authenticated using (true) with check (true);
