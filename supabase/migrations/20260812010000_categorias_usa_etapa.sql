-- Nem toda categoria faz sentido classificar por etapa da obra (ex:
-- "Despesas Administrativas" nao e uma etapa fisica do cronograma, ao
-- contrario de "Mao de Obra" ou "Material"). Quando false, o fluxo do
-- WhatsApp pula a pergunta de etapa pra essa categoria.
alter table categorias
  add column if not exists usa_etapa boolean not null default true;
