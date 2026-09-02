-- Checklist de tarefas dentro de cada etapa - diferente do sistema de
-- Qualidade removido (esse era inspecao com aprovacao/reprovacao); aqui e
-- so uma lista de afazeres com status individual (pendente/concluida/
-- atrasada), pra acompanhar o progresso real dentro de uma etapa que
-- agrupa varias frentes de trabalho (ex: um mes inteiro de cronograma).
create table if not exists etapa_tarefas (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references etapas(id) on delete cascade,
  descricao text not null,
  status text not null default 'pendente',
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists etapa_tarefas_etapa_id_idx on etapa_tarefas(etapa_id);

alter table etapa_tarefas enable row level security;

create policy "authenticated full access" on etapa_tarefas
  for all to authenticated using (true) with check (true);

-- Popula as tarefas reais do contrato do Alexson pra "02 Costa Amalfitana",
-- uma linha por item, no mes (etapa) certo.
insert into etapa_tarefas (etapa_id, descricao, ordem)
select e.id, t.descricao, t.ordem
from (values
  ('1º Mês — Canteiro, Fundações e Início das Alvenarias', 'Implantação e organização do canteiro de obras.', 1),
  ('1º Mês — Canteiro, Fundações e Início das Alvenarias', 'Execução da armação dos radiês.', 2),
  ('1º Mês — Canteiro, Fundações e Início das Alvenarias', 'Execução das passagens elétricas, hidráulicas e sanitárias nos radiês.', 3),
  ('1º Mês — Canteiro, Fundações e Início das Alvenarias', 'Armação das colunas.', 4),
  ('1º Mês — Canteiro, Fundações e Início das Alvenarias', 'Execução das alvenarias até a altura das janelas.', 5),
  ('1º Mês — Canteiro, Fundações e Início das Alvenarias', 'Execução dos muros limítrofes.', 6),
  ('1º Mês — Canteiro, Fundações e Início das Alvenarias', 'Execução da fossa da Casa 17.', 7),

  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Continuação das alvenarias até a altura da laje.', 1),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Cortes nas paredes para instalação dos eletrodutos.', 2),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Instalação das caixas elétricas de tomadas e interruptores.', 3),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Instalação dos eletrodutos e das caixas de passagem nas paredes.', 4),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Cortes nas paredes para passagem das tubulações hidráulicas.', 5),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Escavação das piscinas.', 6),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Execução das armações das piscinas.', 7),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Execução das instalações hidráulicas das piscinas.', 8),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Execução das alvenarias das piscinas.', 9),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Execução do reboco das piscinas.', 10),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Perfuração dos poços artesianos no fundo das três casas.', 11),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 'Verificar previamente se a BRK fornecerá água (confirmar necessidade dos poços artesianos).', 12),

  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução de chapisco interno e externo.', 1),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução de todo o reboco interno e externo.', 2),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das pingadeiras.', 3),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das alvenarias das platibandas.', 4),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Instalação das caixas-d''água.', 5),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das calhas.', 6),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução do madeiramento do telhado.', 7),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Instalação das telhas.', 8),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Passagem da fiação elétrica.', 9),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das tubulações hidráulicas.', 10),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução do sistema de drenagem pluvial.', 11),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das captações de águas pluviais.', 12),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das descidas de águas pluviais.', 13),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das caixas de drenagem.', 14),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das caixas de esgoto.', 15),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Execução das caixas de gordura.', 16),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Início dos serviços de forro de gesso.', 17),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 'Impermeabilização das lajes.', 18),

  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Finalização dos forros de gesso.', 1),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Execução dos rufos.', 2),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Assentamento dos revestimentos de parede.', 3),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Assentamento dos porcelanatos dos pisos.', 4),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Instalação das soleiras.', 5),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Execução dos rodapés.', 6),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Aplicação do selador nas paredes.', 7),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Aplicação da primeira demão de tinta.', 8),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Instalação das luminárias.', 9),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Instalação das esquadrias.', 10),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Execução dos muros de divisa entre as casas.', 11),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Início da execução dos muros das fachadas.', 12),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Execução das cascatas das piscinas.', 13),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Execução dos contrapisos das áreas de lazer.', 14),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Execução dos contrapisos das áreas de serviço.', 15),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Execução das churrasqueiras.', 16),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 'Chumbamento dos suportes para coberturas de policarbonato (lazer e serviço).', 17),

  ('5º Mês — Acabamentos e Finalização das Obras', 'Instalação das bancadas.', 1),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Finalização dos pisos.', 2),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Finalização dos muros das fachadas.', 3),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Assentamento dos revestimentos das piscinas.', 4),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Execução dos pisos amadeirados das áreas de lazer.', 5),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Execução das placas de concreto nas entradas das garagens.', 6),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Execução das placas de concreto nas laterais das casas.', 7),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Instalação das louças e metais.', 8),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Execução do gramado.', 9),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Execução do paisagismo.', 10),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Aplicação das duas demãos finais de tinta.', 11),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Instalação das coberturas de policarbonato das áreas de lazer.', 12),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Instalação das coberturas de policarbonato das áreas de serviço.', 13),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Finalização dos serviços pendentes.', 14),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Limpeza geral das casas.', 15),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Testes das instalações e equipamentos.', 16),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Correção das pendências identificadas.', 17),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Vistoria final.', 18),
  ('5º Mês — Acabamentos e Finalização das Obras', 'Conclusão das três casas.', 19)
) as t(etapa_nome, descricao, ordem)
join etapas e on e.nome = t.etapa_nome
join obras o on o.id = e.obra_id and o.nome = '02 Costa Amalfitana'
where e.deleted_at is null;
