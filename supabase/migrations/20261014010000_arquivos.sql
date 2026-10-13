-- Biblioteca de arquivos: matricula, alvara, certidoes, editais, projetos...
-- Organizada por area > pasta > tipo:
--   obra       -> pasta = a propria obra (obra_id)
--   licitacao  -> pasta = nome da licitacao (texto livre)
--   empresa / pessoal -> pasta opcional (texto livre)
-- O arquivo em si fica no bucket "comprovantes" (prefixo arquivos/).
create table if not exists arquivos (
  id uuid primary key default gen_random_uuid(),
  area text not null default 'obra' check (area in ('obra', 'licitacao', 'empresa', 'pessoal')),
  obra_id uuid references obras(id) on delete set null,
  pasta text,
  tipo text not null default 'Outros',
  nome text not null,
  descricao text,
  nome_arquivo text,
  storage_bucket text not null default 'comprovantes',
  storage_path text not null,
  mime_type text,
  tamanho_bytes bigint,
  -- Validade (certidao, alvara...). Vazio = documento sem prazo.
  validade date,
  avisar_dias_antes integer not null default 30,
  aviso_antecipado_em timestamptz,
  aviso_vencimento_em timestamptz,
  origem text not null default 'whatsapp',
  enviado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arquivos_area_idx on arquivos (area, obra_id, tipo);
create index if not exists arquivos_validade_idx on arquivos (validade) where validade is not null;

alter table arquivos enable row level security;

create policy "authenticated full access" on arquivos
  for all to authenticated using (true) with check (true);
