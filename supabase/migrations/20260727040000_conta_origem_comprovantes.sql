-- Dados da conta de origem identificados em comprovantes de pagamento.

alter table despesa_comprovantes
  add column if not exists conta_origem_banco text,
  add column if not exists conta_origem_titular text,
  add column if not exists conta_origem_documento text,
  add column if not exists conta_origem_agencia text,
  add column if not exists conta_origem_numero text,
  add column if not exists metodo_pagamento text;
