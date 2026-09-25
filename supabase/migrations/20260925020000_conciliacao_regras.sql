-- Regras aprendidas na conciliacao bancaria: quando o usuario ignora ou lanca
-- um pagamento, o app lembra pra quem foi e aplica igual nos proximos extratos.
create table if not exists conciliacao_regras (
  id uuid primary key default gen_random_uuid(),
  -- beneficiario normalizado (minusculo, sem acento), ex: "marsol distribuido"
  chave text not null unique,
  acao text not null check (acao in ('ignorar', 'lancar')),
  obra_id uuid references obras(id) on delete set null,
  categoria_id uuid references categorias(id) on delete set null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  exemplo text,
  vezes_usada integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conciliacao_regras enable row level security;

create policy "authenticated full access" on conciliacao_regras
  for all to authenticated using (true) with check (true);
