create table if not exists extratos_bancarios (
  id uuid primary key default gen_random_uuid(),
  conta_bancaria_id uuid references contas_bancarias(id),
  periodo_inicio date,
  periodo_fim date,
  storage_bucket text not null default 'comprovantes',
  storage_path text not null,
  nome_arquivo text,
  status text not null default 'processando',
  erro text,
  total_transacoes int not null default 0,
  total_conciliadas int not null default 0,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists extrato_transacoes (
  id uuid primary key default gen_random_uuid(),
  extrato_id uuid not null references extratos_bancarios(id) on delete cascade,
  data date not null,
  descricao text,
  valor numeric not null,
  tipo text not null,
  despesa_id uuid references despesas(id),
  status text not null default 'pendente',
  created_at timestamptz not null default now()
);

create index if not exists extrato_transacoes_extrato_id_idx on extrato_transacoes(extrato_id);
create index if not exists extrato_transacoes_despesa_id_idx on extrato_transacoes(despesa_id);

alter table extratos_bancarios enable row level security;
alter table extrato_transacoes enable row level security;

create policy "authenticated full access" on extratos_bancarios
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on extrato_transacoes
  for all to authenticated using (true) with check (true);

alter table atividades drop constraint if exists atividades_entidade_check;

alter table atividades add constraint atividades_entidade_check
  check (entidade in (
    'despesa', 'obra', 'categoria', 'material', 'fornecedor', 'orcamento',
    'usuario_whatsapp', 'medicao', 'contrato_fornecedor',
    'cronograma_template', 'checklist_template', 'conta_bancaria', 'etapa',
    'extrato_bancario'
  ));
