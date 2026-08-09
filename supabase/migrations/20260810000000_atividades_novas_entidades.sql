-- A lixeira generica (restoreFromTrashAction/permanentlyDeleteFromTrashAction)
-- registra atividade usando o proprio tipo da entidade. Preparando pra
-- cobrir medicao/contrato/modelos/etapa/conta bancaria na lixeira (blocos 1
-- e 2 da auditoria), a checagem antiga bloqueava esses valores novos.
alter table atividades drop constraint if exists atividades_entidade_check;

alter table atividades add constraint atividades_entidade_check
  check (entidade in (
    'despesa', 'obra', 'categoria', 'material', 'fornecedor', 'orcamento',
    'usuario_whatsapp', 'medicao', 'contrato_fornecedor',
    'cronograma_template', 'checklist_template', 'conta_bancaria', 'etapa'
  ));
