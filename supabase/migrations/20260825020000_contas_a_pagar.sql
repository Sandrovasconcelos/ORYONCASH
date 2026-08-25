-- Obra deixa de ser obrigatoria em despesa: despesas administrativas da
-- empresa (aluguel de sala, luz, contabilidade) nao pertencem a nenhuma
-- obra especifica - antes disso so dava pra lancar "prendendo" numa obra
-- qualquer, distorcendo o custo real de cada construcao.
alter table despesas alter column obra_id drop not null;

-- "Titulo a pagar" unificado: cobre tanto conta avulsa recorrente (aluguel,
-- luz) quanto parcela de contrato de fornecedor (contrato_fornecedor_id
-- preenchido). Quando marcada como paga, gera uma despesa de verdade
-- (despesa_id) com a data do pagamento, nao a data de vencimento.
create table if not exists contas_a_pagar (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric(14, 2) not null,
  categoria_id uuid references categorias(id),
  obra_id uuid references obras(id),
  etapa_id uuid references etapas(id),
  fornecedor_id uuid references fornecedores(id),
  contrato_fornecedor_id uuid references contratos_fornecedor(id),
  data_vencimento date not null,
  recorrencia text not null default 'nenhuma',
  avisar_dias_antes int not null default 3,
  status text not null default 'pendente',
  despesa_id uuid references despesas(id),
  storage_bucket text,
  storage_path text,
  nome_arquivo text,
  created_at timestamptz not null default now(),
  created_by text,
  pago_em timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text
);

create index if not exists contas_a_pagar_status_vencimento_idx
  on contas_a_pagar(status, data_vencimento);
create index if not exists contas_a_pagar_obra_id_idx on contas_a_pagar(obra_id);
create index if not exists contas_a_pagar_contrato_fornecedor_id_idx
  on contas_a_pagar(contrato_fornecedor_id);

alter table contas_a_pagar enable row level security;

create policy "authenticated full access" on contas_a_pagar
  for all to authenticated using (true) with check (true);

alter table atividades drop constraint if exists atividades_entidade_check;

alter table atividades add constraint atividades_entidade_check
  check (entidade in (
    'despesa', 'obra', 'categoria', 'material', 'fornecedor', 'orcamento',
    'usuario_whatsapp', 'medicao', 'contrato_fornecedor',
    'cronograma_template', 'checklist_template', 'conta_bancaria', 'etapa',
    'extrato_bancario', 'conta_a_pagar'
  ));
