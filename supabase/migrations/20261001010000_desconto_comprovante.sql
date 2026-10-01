-- Quando a soma dos itens de uma nota nao bate com o total final (fornecedor
-- deu desconto, ou cobrou frete nao itemizado), o app rateia a diferenca
-- entre os itens (lib/gemini/rateioDesconto.ts) pra lancar o que de fato foi
-- pago. Esses dois campos guardam o "antes e depois" pra explicar isso na
-- tela de Lancamentos, em vez do desconto ficar escondido so em Atividades.
alter table despesa_comprovantes
  add column if not exists valor_desconto numeric,
  add column if not exists valor_itens_original numeric;
