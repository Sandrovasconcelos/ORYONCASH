-- Lixeira recuperável para cadastros e lançamentos.
-- O registro deixa de aparecer no app normal, mas pode ser restaurado.

alter table obras
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deleted_reason text;

alter table categorias
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deleted_reason text;

alter table materiais
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deleted_reason text;

alter table fornecedores
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deleted_reason text;

alter table despesas
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deleted_reason text;

create index if not exists obras_deleted_at_idx on obras(deleted_at);
create index if not exists categorias_deleted_at_idx on categorias(deleted_at);
create index if not exists materiais_deleted_at_idx on materiais(deleted_at);
create index if not exists fornecedores_deleted_at_idx on fornecedores(deleted_at);
create index if not exists despesas_deleted_at_idx on despesas(deleted_at);
