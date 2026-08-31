-- Permite escopar um contrato de fornecedor tambem por categoria (ex: "Mao
-- de obra"), nao so por etapa - resolve o caso de um mesmo fornecedor ter
-- mais de um contrato na mesma obra (ex: um de material, outro de mao de
-- obra) sem etapa que os diferencie.
alter table contratos_fornecedor
  add column if not exists categoria_id uuid references categorias(id) on delete set null;
