-- Data real de conclusao da etapa (diferente de data_fim_prevista, que e
-- so o planejado). Preenchida automaticamente quando a etapa chega a 100%
-- (seja por tarefas ou por edicao manual do %), e limpa se ela deixar de
-- estar 100% (ex: reabriu uma tarefa por engano).
alter table etapas add column if not exists data_conclusao_real date;
