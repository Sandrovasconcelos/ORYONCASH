-- Icones desenhados pela IA para categorias/etapas que nao se encaixam em nenhum
-- icone da biblioteca. Chave = nome normalizado (sem acento, minusculo), entao
-- etapas com o mesmo nome em obras diferentes compartilham o mesmo icone.
create table if not exists icones_personalizados (
  nome_normalizado text primary key,
  nome text not null,
  svg text not null,
  created_at timestamptz not null default now()
);

alter table icones_personalizados enable row level security;
