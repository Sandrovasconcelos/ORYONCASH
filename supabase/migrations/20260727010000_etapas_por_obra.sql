-- Permite que cada obra tenha suas proprias etapas (importadas de um
-- orcamento real) com valor orcado, mantendo as etapas globais (obra_id
-- nulo) como modelo padrao para obras sem orcamento detalhado importado.

alter table etapas add column if not exists obra_id uuid references obras(id) on delete cascade;
alter table etapas add column if not exists valor_orcado numeric(14, 2);

alter table etapas drop constraint if exists etapas_nome_key;

alter table etapas add constraint etapas_obra_id_nome_key unique (obra_id, nome);

create index if not exists etapas_obra_id_idx on etapas(obra_id);
