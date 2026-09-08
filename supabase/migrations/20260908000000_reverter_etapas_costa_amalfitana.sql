-- Reverte a etapa "02 Costa Amalfitana" pra lista detalhada de fases que
-- existia antes do cronograma mensal (necessaria pro fluxo do WhatsApp, que
-- ficou pobre demais com so 5 opcoes de mes). As 5 etapas mensais (e as
-- tarefas do cronograma fisico) ficam arquivadas, nao apagadas - da pra
-- reativar depois se precisar.

-- Restaura as fases detalhadas antigas.
update etapas
set deleted_at = null, deleted_by = null, deleted_reason = null
where obra_id = (select id from obras where nome = '02 Costa Amalfitana' limit 1)
  and deleted_by = 'Migração de cronograma';

-- Arquiva as 5 etapas mensais do cronograma (etapa_tarefas ficam intactas,
-- so passam a nao aparecer em nenhuma tela por nao terem etapa ativa).
update etapas
set
  deleted_at = now(),
  deleted_by = 'Reversão solicitada pelo usuário',
  deleted_reason = 'Etapa da obra voltou a ser a lista detalhada de fases (necessária pro WhatsApp)'
where obra_id = (select id from obras where nome = '02 Costa Amalfitana' limit 1)
  and nome like '_º Mês —%'
  and deleted_at is null;
