alter table obras
  add column if not exists categoria_medicao_padrao_id uuid references categorias(id);
