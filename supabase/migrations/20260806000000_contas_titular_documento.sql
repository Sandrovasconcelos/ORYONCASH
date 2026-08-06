-- Titular/documento de cada conta cadastrada, pra diferenciar contas do
-- mesmo banco (ex: duas contas Caixa) ao casar com o que foi extraido do
-- comprovante de pagamento.
alter table contas_bancarias
  add column if not exists titular text,
  add column if not exists documento text;

-- Retoma a migration 20260727040000_conta_origem_comprovantes.sql, que nao
-- chegou a ser aplicada: guarda o que a IA identificou como conta de
-- origem do pagamento em cada comprovante.
alter table despesa_comprovantes
  add column if not exists conta_origem_banco text,
  add column if not exists conta_origem_titular text,
  add column if not exists conta_origem_documento text,
  add column if not exists conta_origem_agencia text,
  add column if not exists conta_origem_numero text,
  add column if not exists metodo_pagamento text;
