-- Arquiva as etapas genericas atuais da obra "02 Costa Amalfitana" (mantem
-- despesas ja lancadas com referencia valida - so fica fora das listas
-- ativas). Substituidas pelo cronograma real do contrato do Alexson,
-- organizado por mes.
update etapas
set
  deleted_at = now(),
  deleted_by = 'Migração de cronograma',
  deleted_reason = 'Substituída pelo cronograma real do contrato (5 etapas por mês)'
where obra_id = (select id from obras where nome = '02 Costa Amalfitana' limit 1)
  and deleted_at is null;

insert into etapas (obra_id, nome, ordem)
select id, '1º Mês — Canteiro, Fundações e Início das Alvenarias', 1
from obras where nome = '02 Costa Amalfitana'
union all
select id, '2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 2
from obras where nome = '02 Costa Amalfitana'
union all
select id, '3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 3
from obras where nome = '02 Costa Amalfitana'
union all
select id, '4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 4
from obras where nome = '02 Costa Amalfitana'
union all
select id, '5º Mês — Acabamentos e Finalização das Obras', 5
from obras where nome = '02 Costa Amalfitana';
