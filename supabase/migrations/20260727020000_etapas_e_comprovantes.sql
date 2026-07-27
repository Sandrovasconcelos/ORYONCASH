-- Gestão manual de etapas por obra e armazenamento de comprovantes
-- recebidos pelo WhatsApp.

alter table etapas add column if not exists obra_id uuid references obras(id) on delete cascade;
alter table etapas add column if not exists valor_orcado numeric(14, 2);

alter table etapas drop constraint if exists etapas_nome_key;
alter table etapas drop constraint if exists etapas_obra_id_nome_key;
alter table etapas add constraint etapas_obra_id_nome_key unique (obra_id, nome);

create index if not exists etapas_obra_id_idx on etapas(obra_id);

create table if not exists despesa_comprovantes (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid references despesas(id) on delete cascade,
  tipo_documento text not null default 'documento_cobranca'
    check (tipo_documento in ('documento_cobranca', 'comprovante_pagamento', 'outro')),
  whatsapp_media_id text,
  storage_bucket text not null default 'comprovantes',
  storage_path text not null,
  mime_type text not null,
  nome_arquivo text,
  origem text not null default 'whatsapp' check (origem in ('whatsapp', 'dashboard')),
  created_at timestamptz not null default now()
);

alter table despesa_comprovantes
  add column if not exists tipo_documento text not null default 'documento_cobranca';

alter table despesa_comprovantes
  drop constraint if exists despesa_comprovantes_tipo_documento_check;

alter table despesa_comprovantes
  add constraint despesa_comprovantes_tipo_documento_check
  check (tipo_documento in ('documento_cobranca', 'comprovante_pagamento', 'outro'));

create index if not exists despesa_comprovantes_despesa_id_idx
  on despesa_comprovantes(despesa_id);

create index if not exists despesa_comprovantes_created_at_idx
  on despesa_comprovantes(created_at desc);

alter table despesa_comprovantes enable row level security;

drop policy if exists "authenticated read comprovantes" on despesa_comprovantes;
create policy "authenticated read comprovantes" on despesa_comprovantes
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated write comprovantes" on despesa_comprovantes;
create policy "authenticated write comprovantes" on despesa_comprovantes
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read storage comprovantes" on storage.objects;
create policy "authenticated read storage comprovantes" on storage.objects
  for select using (
    bucket_id = 'comprovantes'
    and auth.role() = 'authenticated'
  );

drop policy if exists "authenticated write storage comprovantes" on storage.objects;
create policy "authenticated write storage comprovantes" on storage.objects
  for all using (
    bucket_id = 'comprovantes'
    and auth.role() = 'authenticated'
  )
  with check (
    bucket_id = 'comprovantes'
    and auth.role() = 'authenticated'
  );
