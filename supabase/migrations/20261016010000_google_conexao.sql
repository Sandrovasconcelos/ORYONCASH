-- Conexao com o Google Drive do dono (OAuth). Uma unica linha. Sem policies:
-- so o servidor (service role) le e grava - o token nunca vai pro navegador.
-- Arquivos guardados no Drive usam storage_bucket = 'drive' e storage_path =
-- id do arquivo no Drive.
create table if not exists google_conexao (
  id boolean primary key default true check (id),
  refresh_token text not null,
  email text,
  conectado_em timestamptz not null default now()
);

alter table google_conexao enable row level security;
