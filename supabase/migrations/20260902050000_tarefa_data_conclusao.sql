-- Data real de conclusao de cada TAREFA (nao so da etapa inteira) - uma
-- tarefa pode nao terminar dentro do mes planejado e "vazar" pro proximo,
-- entao o usuario precisa da data individual de cada uma pra saber o que
-- atrasou.
alter table etapa_tarefas add column if not exists data_conclusao_real date;
