-- Schema inicial: obras, catalogos (categorias/etapas/materiais/fornecedores),
-- despesas e sessoes de conversa do bot do WhatsApp.

create extension if not exists "pgcrypto";

create table if not exists obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  orcamento_total numeric(14, 2) not null default 0,
  data_inicio date,
  status text not null default 'ativa' check (status in ('ativa', 'concluida')),
  created_at timestamptz not null default now()
);

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists etapas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  categoria_id uuid references categorias(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  created_at timestamptz not null default now()
);

create table if not exists despesas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  categoria_id uuid not null references categorias(id),
  etapa_id uuid references etapas(id),
  material_id uuid references materiais(id),
  fornecedor_id uuid references fornecedores(id),
  descricao text,
  valor numeric(14, 2) not null check (valor > 0),
  data date not null default current_date,
  origem text not null default 'whatsapp' check (origem in ('whatsapp', 'dashboard')),
  created_at timestamptz not null default now()
);

create index if not exists despesas_obra_id_idx on despesas(obra_id);
create index if not exists despesas_categoria_id_idx on despesas(categoria_id);
create index if not exists despesas_etapa_id_idx on despesas(etapa_id);

-- Guarda o progresso da conversa de cada numero de telefone no bot.
create table if not exists whatsapp_sessions (
  telefone text primary key,
  estado_atual text not null default 'menu_principal',
  dados_coletados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS: uso pessoal com um unico usuario autenticado no dashboard. O bot do
-- WhatsApp acessa via service-role key (sempre ignora RLS), entao as
-- policies abaixo cobrem apenas o acesso do dashboard web.
alter table obras enable row level security;
alter table categorias enable row level security;
alter table etapas enable row level security;
alter table materiais enable row level security;
alter table fornecedores enable row level security;
alter table despesas enable row level security;
alter table whatsapp_sessions enable row level security;

create policy "authenticated full access" on obras
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on categorias
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on etapas
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on materiais
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on fornecedores
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on despesas
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on whatsapp_sessions
  for all to authenticated using (true) with check (true);
