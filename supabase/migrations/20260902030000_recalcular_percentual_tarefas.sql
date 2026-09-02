-- Corrige os dados que ficaram zerados por um bug: salvar a Configuração
-- da etapa (fornecedor/datas) sobrescrevia o % executado calculado pelas
-- tarefas com 0, porque o campo de % vira texto (sem input) quando a etapa
-- tem tarefas, e o formulario nao mandava esse campo. Recalcula agora
-- direto do estado real das tarefas.
update etapas e
set
  percentual_executado = coalesce(sub.pct, 0),
  data_conclusao_real = case
    when coalesce(sub.pct, 0) >= 100 then coalesce(e.data_conclusao_real, current_date)
    else null
  end
from (
  select
    etapa_id,
    round(100.0 * count(*) filter (where status = 'concluida') / count(*)) as pct
  from etapa_tarefas
  group by etapa_id
) sub
where sub.etapa_id = e.id;
