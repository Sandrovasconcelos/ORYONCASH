-- Preenche o valor orcado de cada etapa (mes) da "02 Costa Amalfitana" com
-- o cronograma financeiro real do contrato do Alexson. A parcela da
-- assinatura (R$ 25.000,00) nao e de um mes especifico - somada ao 1º mes,
-- que e quando a obra comeca.
update etapas e
set valor_orcado = v.valor
from (values
  ('1º Mês — Canteiro, Fundações e Início das Alvenarias', 50000.00),
  ('2º Mês — Alvenarias, Instalações Embutidas, Piscinas e Poços', 81200.00),
  ('3º Mês — Reboco, Cobertura, Instalações e Impermeabilização', 87400.00),
  ('4º Mês — Revestimentos, Esquadrias, Pintura e Áreas Externas', 81200.00),
  ('5º Mês — Acabamentos e Finalização das Obras', 93800.00)
) as v(etapa_nome, valor)
join obras o on o.nome = '02 Costa Amalfitana'
where e.nome = v.etapa_nome and e.obra_id = o.id and e.deleted_at is null;

-- Corrige o valor total do contrato do Alexson pra bater com o cronograma
-- financeiro real (estava cadastrado com R$ 315.000,00, o certo e
-- R$ 393.600,00).
update contratos_fornecedor cf
set valor_contrato = 393600.00
from fornecedores f, obras o
where cf.fornecedor_id = f.id
  and cf.obra_id = o.id
  and f.nome = 'Alexson Gregory Leite Ferreira'
  and o.nome = '02 Costa Amalfitana'
  and cf.deleted_at is null;
