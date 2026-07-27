-- Autoria por numero de WhatsApp (nome + autorizacao self-service, no lugar
-- do env var ALLOWED_WHATSAPP_NUMBERS) e log de auditoria completo
-- (criacao/edicao/exclusao) para o historico do dashboard.

create table if not exists usuarios_whatsapp (
  telefone text primary key,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists atividades (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('criacao', 'edicao', 'exclusao')),
  entidade text not null check (entidade in ('despesa', 'obra', 'categoria', 'material', 'fornecedor', 'orcamento', 'usuario_whatsapp')),
  entidade_id uuid,
  origem text not null check (origem in ('whatsapp', 'dashboard')),
  autor_telefone text,
  autor_nome text,
  resumo text not null,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz not null default now()
);

create index if not exists atividades_created_at_idx on atividades(created_at desc);
create index if not exists atividades_entidade_idx on atividades(entidade);

alter table despesas add column if not exists criado_por_telefone text;
alter table despesas add column if not exists criado_por_nome text;

alter table usuarios_whatsapp enable row level security;
alter table atividades enable row level security;

create policy "authenticated full access" on usuarios_whatsapp
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on atividades
  for all to authenticated using (true) with check (true);
