-- Catalogos padrao de categorias e etapas de obra, usados nas listas do bot.

insert into categorias (nome) values
  ('Material'),
  ('Mão de Obra'),
  ('Locação de Equipamentos'),
  ('Compra de Equipamentos'),
  ('Despesas Administrativas')
on conflict (nome) do nothing;

insert into etapas (nome, ordem) values
  ('Fundação', 1),
  ('Mobilização e Estruturas', 2),
  ('Alvenaria de Elevação', 3),
  ('Cobertura', 4),
  ('Esquadrias e Ferragens', 5),
  ('Instalações Hidrossanitárias', 6),
  ('Instalações Elétricas', 7),
  ('Revestimentos e Acabamentos', 8),
  ('Pintura', 9),
  ('Entrega Final', 10)
on conflict (nome) do nothing;
