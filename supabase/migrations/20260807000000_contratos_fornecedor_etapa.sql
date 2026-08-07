-- Permite escopar um contrato de fornecedor a uma etapa especifica, pra
-- rastrear contrato -> qualidade -> pagamento sem misturar despesas de
-- outras etapas do mesmo fornecedor na obra.
alter table contratos_fornecedor
  add column if not exists etapa_id uuid references etapas(id) on delete set null;
