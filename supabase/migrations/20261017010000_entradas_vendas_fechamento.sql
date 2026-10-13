-- Entradas de caixa, vendas parceladas e fechamento mensal.
--
-- Ideia: o extrato bancario continua sendo a fonte da verdade do caixa. Cada
-- transacao do extrato (credito ou debito) ganha uma CLASSIFICACAO - assim o
-- fechamento do mes soma tudo por tipo e compara com o saldo do banco.
--   debito  -> despesa de obra (despesa_id) | aplicacao | outra saida
--   credito -> venda (parcela) | aporte de socio | rendimento | resgate | outra entrada
-- Aplicacao e resgate sao TRANSFERENCIA entre conta corrente e investimento
-- (mexem no saldo, mas nao sao receita nem despesa).

-- Contas: corrente ou investimento.
alter table contas_bancarias add column if not exists tipo text not null default 'corrente'
  check (tipo in ('corrente', 'investimento'));
alter table contas_bancarias add column if not exists data_saldo_inicial date;

-- Vendas (ex: uma casa vendida parcelado direto pela construtora).
create table if not exists vendas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete set null,
  cliente_nome text not null,
  cliente_telefone text,
  cliente_documento text,
  unidade text,
  valor_total numeric(14, 2) not null check (valor_total > 0),
  data_contrato date,
  observacao text,
  status text not null default 'ativa' check (status in ('ativa', 'quitada', 'cancelada')),
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists parcelas_venda (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  numero integer not null default 0,
  tipo text not null default 'parcela' check (tipo in ('entrada', 'parcela', 'intermediaria', 'chaves', 'outra')),
  vencimento date not null,
  valor numeric(14, 2) not null check (valor > 0),
  status text not null default 'a_receber' check (status in ('a_receber', 'recebida', 'cancelada')),
  recebido_em date,
  valor_recebido numeric(14, 2),
  conta_bancaria_id uuid references contas_bancarias(id) on delete set null,
  aviso_enviado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists parcelas_venda_venda_idx on parcelas_venda (venda_id, numero);
create index if not exists parcelas_venda_vencimento_idx on parcelas_venda (vencimento) where status = 'a_receber';

-- Classificacao das transacoes do extrato.
alter table extrato_transacoes add column if not exists classificacao text
  check (classificacao in ('venda', 'aporte', 'rendimento', 'outra_entrada', 'resgate', 'aplicacao', 'outra_saida'));
alter table extrato_transacoes add column if not exists parcela_id uuid references parcelas_venda(id) on delete set null;
alter table extrato_transacoes add column if not exists observacao text;

create index if not exists extrato_transacoes_parcela_idx on extrato_transacoes (parcela_id) where parcela_id is not null;

-- Saldo informado em uma data (o que o banco mostra no extrato; e a posicao do investimento).
create table if not exists saldos_conta (
  id uuid primary key default gen_random_uuid(),
  conta_bancaria_id uuid not null references contas_bancarias(id) on delete cascade,
  data date not null,
  valor numeric(14, 2) not null,
  observacao text,
  created_at timestamptz not null default now(),
  unique (conta_bancaria_id, data)
);

alter table vendas enable row level security;
alter table parcelas_venda enable row level security;
alter table saldos_conta enable row level security;

create policy "authenticated full access" on vendas for all to authenticated using (true) with check (true);
create policy "authenticated full access" on parcelas_venda for all to authenticated using (true) with check (true);
create policy "authenticated full access" on saldos_conta for all to authenticated using (true) with check (true);

-- Creditos que o sistema antes descartava como "ignorados" passam a aguardar classificacao
-- (exceto resgate e rendimento, que ja se reconhecem pelo texto).
update extrato_transacoes
set classificacao = 'resgate', status = 'conciliado'
where tipo = 'credito' and classificacao is null and descricao ilike '%resgate%';

update extrato_transacoes
set classificacao = 'rendimento', status = 'conciliado'
where tipo = 'credito' and classificacao is null and descricao ilike '%rendiment%';

update extrato_transacoes
set status = 'pendente'
where tipo = 'credito' and status = 'ignorado' and classificacao is null;

-- Debitos de aplicacao financeira que ja estavam ignorados ganham a classificacao.
update extrato_transacoes
set classificacao = 'aplicacao'
where tipo = 'debito' and classificacao is null and despesa_id is null and descricao ilike '%aplica%';
