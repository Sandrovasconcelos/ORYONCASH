alter table despesas
  add column if not exists quantidade numeric(12, 3),
  add column if not exists valor_unitario numeric(14, 2);
