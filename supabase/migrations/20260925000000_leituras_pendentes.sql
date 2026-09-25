-- Fila de documentos (nota/comprovante) que o Gemini nao conseguiu ler na
-- hora por indisponibilidade do provedor. O arquivo ja esta salvo no Storage;
-- uma cadeia de tentativas em segundo plano (/api/gemini/reprocessar) le de
-- novo e retoma a conversa do usuario quando conseguir.
create table if not exists leituras_pendentes (
  id uuid primary key default gen_random_uuid(),
  telefone text not null,
  comprovante jsonb not null,
  forcar_nova_despesa boolean not null default false,
  tentativas integer not null default 0,
  status text not null default 'pendente'
    check (status in ('pendente', 'processando', 'concluida', 'desistiu')),
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leituras_pendentes_status
  on leituras_pendentes(status, updated_at);

alter table leituras_pendentes enable row level security;

create policy "authenticated full access" on leituras_pendentes
  for all to authenticated using (true) with check (true);
